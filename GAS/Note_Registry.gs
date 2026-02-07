/**
 * XEENAPS PKM - NOTEBOOK REGISTRY MODULE (HYBRID MODE)
 * NOTE: Metadata now managed by Supabase.
 * This module handles Physical JSON Sharding on Google Drive.
 */

function setupNotebookDatabase() {
  return { status: 'success', message: 'Notebook Metadata is now managed by Supabase.' };
}

/**
 * Worker: Save Note Content (JSON) to Drive (Sharding)
 * Returns fileId, nodeUrl, and calculated searchIndex for Supabase Registry.
 */
function saveNoteContentToDrive(item, content) {
  try {
    // --- LOGIC: SHARDING JSON PAYLOAD & SEARCH INDEXING ---
    if (content && (content.description !== undefined || (content.attachments && content.attachments.length > 0))) {
      
      // BUILD SEARCH INDEX (Backend search enhancement)
      let indexText = (content.description || "").replace(/<[^>]*>/g, ' '); 
      if (content.attachments && Array.isArray(content.attachments)) {
        content.attachments.forEach(at => {
          indexText += " " + (at.label || "");
        });
      }
      // Limit index size for DB efficiency (5000 chars is plenty)
      const searchIndex = indexText.substring(0, 5000);

      // Determine Storage Node
      let storageTarget;
      // If updating existing note with known location, try to overwrite
      if (item.noteJsonId && item.storageNodeUrl) {
         storageTarget = { 
           url: item.storageNodeUrl, 
           isLocal: !item.storageNodeUrl || item.storageNodeUrl === ScriptApp.getService().getUrl() 
         };
      } else {
         // New note, find viable node
         storageTarget = getViableStorageTarget(CONFIG.STORAGE.CRITICAL_THRESHOLD);
      }

      if (!storageTarget) throw new Error("Storage Critical: No viable node found.");

      const jsonFileName = `note_${item.id}.json`;
      const jsonBody = JSON.stringify(content);

      let fileId = item.noteJsonId;
      let nodeUrl = item.storageNodeUrl;

      if (storageTarget.isLocal) {
        if (fileId) {
          // Overwrite existing file
          const file = DriveApp.getFileById(fileId);
          file.setContent(jsonBody);
        } else {
          // Create new file
          const folder = DriveApp.getFolderById(CONFIG.FOLDERS.MAIN_LIBRARY);
          const file = folder.createFile(Utilities.newBlob(jsonBody, 'application/json', jsonFileName));
          fileId = file.getId();
        }
        nodeUrl = ScriptApp.getService().getUrl();
      } else {
        // Remote Save
        const res = UrlFetchApp.fetch(storageTarget.url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ 
            action: 'saveJsonFile', 
            fileId: fileId || null, 
            fileName: jsonFileName, 
            content: jsonBody 
          })
        });
        const resJson = JSON.parse(res.getContentText());
        if (resJson.status === 'success') {
          fileId = resJson.fileId;
          nodeUrl = storageTarget.url;
        } else {
           throw new Error(resJson.message || "Remote save failed");
        }
      }

      return { 
        status: 'success', 
        fileId: fileId, 
        nodeUrl: nodeUrl, 
        searchIndex: searchIndex 
      };
    }

    return { status: 'error', message: 'No content to save.' };

  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

// Deprecated functions (handled by Supabase now)
function getNotesFromRegistry() { return { status: 'error', message: 'Use Supabase.' }; }
function deleteNoteFromRegistry() { return { status: 'success', message: 'Handled by Supabase/Frontend.' }; }
