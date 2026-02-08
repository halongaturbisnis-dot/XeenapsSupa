/**
 * XEENAPS PKM - SHARBOX REGISTRY MODULE (HYBRID MODE)
 * Handles P2P Cross-Spreadsheet Knowledge Exchange.
 * "Sent" Logic removed here, only "Inbox" buffer remains for transfer.
 */

function setupSharboxDatabase() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.SHARBOX);
    
    // 1. Inbox Sheet (The Buffer)
    let iSheet = ss.getSheetByName("Inbox");
    if (!iSheet) {
      iSheet = ss.insertSheet("Inbox");
      const headers = CONFIG.SCHEMAS.SHARBOX_INBOX;
      iSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      iSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      iSheet.setFrozenRows(1);
    } else {
      // Auto-update Inbox sheet headers to include isRead
      const currentHeaders = iSheet.getRange(1, 1, 1, iSheet.getLastColumn()).getValues()[0];
      const targetHeaders = CONFIG.SCHEMAS.SHARBOX_INBOX;
      const missing = targetHeaders.filter(h => !currentHeaders.includes(h));
      if (missing.length > 0) {
        iSheet.getRange(1, currentHeaders.length + 1, 1, missing.length).setValues([missing]).setFontWeight("bold").setBackground("#f3f3f3");
      }
    }

    return { status: 'success', message: 'Sharbox structure initialized.' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Handle Knowledge Sharing (Modified: Only writes to Target Inbox)
 * Local Sent history is now handled by Supabase on client-side.
 */
function handleSendToSharbox(targetUniqueAppId, receiverName, receiverPhotoUrl, message, item, receiverContacts) {
  try {
    const profile = getProfileFromRegistry();
    if (!profile) throw new Error("Sender profile not found.");

    // 1. PREPARE PERMISSIONS: Auto-set files to "Anyone with link can view"
    const fileIdsToShare = [item.fileId, item.extractedJsonId, item.insightJsonId].filter(id => id && id.trim() !== "");
    fileIdsToShare.forEach(id => {
       try {
         DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
       } catch (e) {
         console.warn("Failed to set permission for file: " + id);
       }
    });

    const timestamp = new Date().toISOString();
    const transactionId = Utilities.getUuid();

    // 2. WRITE TO TARGET (Receiver's Inbox)
    const targetSS = SpreadsheetApp.openById(targetUniqueAppId);
    let targetInbox = targetSS.getSheetByName("Inbox");
    if (!targetInbox) {
      // Create Inbox if not exists in target SS (User might not have initialized yet)
      targetInbox = targetSS.insertSheet("Inbox");
      targetInbox.getRange(1, 1, 1, CONFIG.SCHEMAS.SHARBOX_INBOX.length).setValues([CONFIG.SCHEMAS.SHARBOX_INBOX]);
    }

    // Map data for SHARBOX_INBOX schema
    const inboxRow = CONFIG.SCHEMAS.SHARBOX_INBOX.map(h => {
      if (h === 'id') return transactionId;
      if (h === 'senderName') return profile.fullName;
      if (h === 'senderPhotoUrl') return profile.photoUrl;
      if (h === 'senderAffiliation') return profile.affiliation;
      if (h === 'senderUniqueAppId') return profile.uniqueAppId;
      if (h === 'senderEmail') return profile.email;
      if (h === 'senderPhone') return profile.phone;
      if (h === 'senderSocialMedia') return profile.socialMedia;
      if (h === 'message') return message || '';
      if (h === 'timestamp') return timestamp;
      if (h === 'status') return 'UNCLAIMED';
      if (h === 'isRead') return false;
      
      // Collection Metadata mapping (prefix id_item)
      const colKey = h === 'id_item' ? 'id' : h;
      const val = item[colKey];
      return (Array.isArray(val) || (typeof val === 'object' && val !== null)) ? JSON.stringify(val) : (val !== undefined ? val : '');
    });
    targetInbox.appendRow(inboxRow);

    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: "Transfer failed: " + e.toString() };
  }
}

/**
 * Retrieval logic for Inbox Buffer
 * Reads 'Inbox' sheet to find pending messages to sync.
 */
function getInboxBufferFromRegistry() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.SHARBOX);
    const sheet = ss.getSheetByName("Inbox");
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const jsonFields = ['authors', 'pubInfo', 'identifiers', 'tags', 'supportingReferences'];

    return data.slice(1).map(row => {
      let obj = {};
      CONFIG.SCHEMAS.SHARBOX_INBOX.forEach(schemaKey => {
        const spreadsheetIdx = headers.indexOf(schemaKey);
        let val = spreadsheetIdx !== -1 ? row[spreadsheetIdx] : '';

        // Handle JSON fields with safe defaults
        if (jsonFields.includes(schemaKey)) {
          try { 
            val = (val && String(val).trim() !== "") ? JSON.parse(val) : (schemaKey === 'authors' ? [] : {});
          } catch(e) { 
            val = (schemaKey === 'authors' ? [] : {}); 
          }
        }
        
        // Final fallback for critical fields to prevent UI crashes
        if (schemaKey === 'title' && !val) val = 'Untitled Document';
        if (schemaKey === 'authors' && !Array.isArray(val)) val = [];
        
        obj[schemaKey] = val;
        
        // Specific boolean parsing for isRead
        if (schemaKey === 'isRead') {
          obj[schemaKey] = (val === true || String(val).toLowerCase() === 'true');
        }
      });
      return obj;
    });
  } catch (e) { return []; }
}

/**
 * Clear Synced Items from Inbox Buffer
 * Deletes rows from Sheet Inbox after successful sync to Supabase.
 */
function clearInboxBuffer(idsToDelete) {
  try {
    if (!idsToDelete || idsToDelete.length === 0) return { status: 'success', message: 'No items to clear.' };

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.SHARBOX);
    const sheet = ss.getSheetByName("Inbox");
    if (!sheet) return { status: 'error', message: 'Inbox sheet not found.' };

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('id');
    
    // We process deletions from bottom to top to avoid index shifting issues
    // OR cleaner approach: Re-write the sheet excluding deleted IDs (Better for batch)
    
    const newBody = [];
    const idsSet = new Set(idsToDelete);
    
    // Start from row 1 (data), keep row 0 (headers)
    for (let i = 1; i < data.length; i++) {
      if (!idsSet.has(data[i][idIdx])) {
        newBody.push(data[i]);
      }
    }

    // Clear everything below header
    if (data.length > 1) {
      sheet.getRange(2, 1, data.length - 1, headers.length).clearContent();
    }
    
    // Write back remaining rows
    if (newBody.length > 0) {
      sheet.getRange(2, 1, newBody.length, headers.length).setValues(newBody);
    }
    
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

/**
 * Legacy: Handle Claim/Import knowledge to local Library
 * Future Proof: Clones JSON content to local Storage Node
 */
function handleClaimSharboxItem(transactionId) {
  try {
    // Note: We can claim from the Buffer sheet directly if it exists, or check arguments.
    // However, with Hybrid model, claiming is done via Supabase client mostly.
    // This legacy function is kept if you want to claim WITHOUT syncing to Supabase first (rare case).
    // Or if `claimSharboxItem` is called from `Main.gs`.
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.SHARBOX);
    const sheet = ss.getSheetByName("Inbox");
    if (!sheet) throw new Error("Inbox not found.");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('id');
    const statusIdx = headers.indexOf('status');
    const idItemIdx = headers.indexOf('id_item');

    let targetRowIndex = -1;
    let sharboxItem = {};
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === transactionId) {
        targetRowIndex = i + 1;
        headers.forEach((h, j) => sharboxItem[h] = data[i][j]);
        break;
      }
    }

    if (targetRowIndex === -1) throw new Error("Item not found in buffer.");
    if (sharboxItem.status === 'CLAIMED') throw new Error("Already claimed.");

    // 1. DATA RECONSTRUCTION for Collections
    const collectionItem = {};
    CONFIG.SCHEMAS.LIBRARY.forEach(h => {
       const key = h === 'id' ? 'id_item' : h;
       let val = sharboxItem[key];
       // JSON Parse safety
       if (['authors', 'pubInfo', 'identifiers', 'tags', 'supportingReferences'].includes(h)) {
         try { 
           val = (val && String(val).trim() !== "") ? JSON.parse(val) : (h === 'authors' ? [] : {});
         } catch(e) {
           val = (h === 'authors' ? [] : {});
         }
       }
       collectionItem[h] = val;
    });

    // OVERWRITE WITH LOCAL TIMESTAMP (NOW)
    const now = new Date().toISOString();
    collectionItem.createdAt = now;
    collectionItem.updatedAt = now;

    // 2. REGISTER TO LOCAL LIBRARY (Legacy Sheet)
    saveToSheet(CONFIG.SPREADSHEETS.LIBRARY, "Collections", collectionItem);

    // 3. MARK AS CLAIMED
    sheet.getRange(targetRowIndex, statusIdx + 1).setValue('CLAIMED');

    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}
