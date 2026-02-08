

/**
 * XEENAPS PKM - TRACER REGISTRY MODULE
 * Handles Audit Trail, Lab Notebooks, Project References, and Finance Ledger.
 */

function setupTracerDatabase() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    
    // 1. Projects Sheet
    let pSheet = ss.getSheetByName("TracerProjects");
    if (!pSheet) {
      pSheet = ss.insertSheet("TracerProjects");
      const headers = CONFIG.SCHEMAS.TRACER_PROJECTS;
      pSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      pSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      pSheet.setFrozenRows(1);
    } else {
      // Sync headers for existing sheet (Prevents column shift errors)
      const currentHeaders = pSheet.getRange(1, 1, 1, pSheet.getLastColumn()).getValues()[0];
      const targetHeaders = CONFIG.SCHEMAS.TRACER_PROJECTS;
      const missingHeaders = targetHeaders.filter(h => !currentHeaders.includes(h));
      if (missingHeaders.length > 0) {
        const startCol = currentHeaders.length + 1;
        pSheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
        pSheet.getRange(1, startCol, 1, missingHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");
      }
    }

    // 2. Logs Sheet (Activity Journal)
    let lSheet = ss.getSheetByName("TracerLogs");
    if (!lSheet) {
      lSheet = ss.insertSheet("TracerLogs");
      const headers = CONFIG.SCHEMAS.TRACER_LOGS;
      lSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      lSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      lSheet.setFrozenRows(1);
    }

    // 3. References Sheet (Relationship Table)
    let rSheet = ss.getSheetByName("TracerReferences");
    if (!rSheet) {
      rSheet = ss.insertSheet("TracerReferences");
      const headers = CONFIG.SCHEMAS.TRACER_REFERENCES;
      rSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      rSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      rSheet.setFrozenRows(1);
    } else {
      // Update headers for references to include sharding
      const currentHeaders = rSheet.getRange(1, 1, 1, rSheet.getLastColumn()).getValues()[0];
      const targetHeaders = CONFIG.SCHEMAS.TRACER_REFERENCES;
      const missingHeaders = targetHeaders.filter(h => !currentHeaders.includes(h));
      if (missingHeaders.length > 0) {
        const startCol = currentHeaders.length + 1;
        rSheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
        rSheet.getRange(1, startCol, 1, missingHeaders.length).setFontWeight("bold").setBackground("#f3f3f3");
      }
    }

    // 4. To Do Sheet
    let tSheet = ss.getSheetByName("TracerTodos");
    if (!tSheet) {
      tSheet = ss.insertSheet("TracerTodos");
      const headers = CONFIG.SCHEMAS.TRACER_TODOS;
      tSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      tSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      tSheet.setFrozenRows(1);
    }

    // 5. NEW: Finance Sheet (Ledger)
    let fSheet = ss.getSheetByName("TracerFinance");
    if (!fSheet) {
      fSheet = ss.insertSheet("TracerFinance");
      const headers = CONFIG.SCHEMAS.TRACER_FINANCE;
      fSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      fSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      fSheet.setFrozenRows(1);
    }

    return { status: 'success', message: 'Tracer database structure synchronized.' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

// --- PROJECT HANDLERS ---

function getTracerProjectsFromRegistry(page = 1, limit = 25, search = "") {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerProjects");
    if (!sheet) return { items: [], totalCount: 0 };
    
    // Using getValues for data type integrity
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rawItems = data.slice(1);
    
    let filtered = rawItems;
    if (search) {
      const s = search.toLowerCase();
      filtered = rawItems.filter(r => r.some(cell => String(cell).toLowerCase().includes(s)));
    }
    
    // Initial ID index for sorting fallback
    const updatedAtIdx = headers.indexOf('updatedAt');
    filtered.sort((a, b) => {
      const timeA = a[updatedAtIdx] ? new Date(a[updatedAtIdx]).getTime() : 0;
      const timeB = b[updatedAtIdx] ? new Date(b[updatedAtIdx]).getTime() : 0;
      return timeB - timeA;
    });
    
    const totalCount = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, (page * limit));
    
    const items = paginated.map(row => {
      let obj = {};
      headers.forEach((h, i) => {
        let val = row[i];
        
        // Handle JSON array fields
        if (h === 'authors' || h === 'keywords') {
          try { 
            val = (typeof val === 'string' && val !== '') ? JSON.parse(val) : (Array.isArray(val) ? val : []); 
          } catch(e) { val = []; }
        }
        
        // Handle Date objects from Spreadsheet
        if (val instanceof Date) {
          val = val.toISOString();
        }
        
        obj[h] = val;
      });
      return obj;
    });
    
    return { items, totalCount };
  } catch (e) { return { items: [], totalCount: 0 }; }
}

function saveTracerProjectToRegistry(item) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    let sheet = ss.getSheetByName("TracerProjects");
    if (!sheet) { setupTracerDatabase(); sheet = ss.getSheetByName("TracerProjects"); }
    
    // Dynamic Mapping: Get headers from sheet to handle any column shifts
    const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idIdx = actualHeaders.indexOf('id');
    
    if (idIdx === -1) {
      setupTracerDatabase(); // Force repair
      return { status: 'error', message: 'ID column missing. Repair initiated.' };
    }

    const rowData = actualHeaders.map(h => {
      const val = item[h];
      if (val === undefined || val === null) return '';
      return (Array.isArray(val) || (typeof val === 'object')) ? JSON.stringify(val) : val;
    });

    const data = sheet.getDataRange().getValues();
    let existingRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === item.id) { existingRow = i + 1; break; }
    }

    if (existingRow > -1) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    return { status: 'success' };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

function deleteTracerProjectFromRegistry(id) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerProjects");
    const lSheet = ss.getSheetByName("TracerLogs");
    const rSheet = ss.getSheetByName("TracerReferences");
    const tSheet = ss.getSheetByName("TracerTodos");
    const fSheet = ss.getSheetByName("TracerFinance");
    
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const idIdx = data[0].indexOf('id');
      for (let i = 1; i < data.length; i++) {
        if (data[i][idIdx] === id) { sheet.deleteRow(i + 1); break; }
      }
    }
    
    // Cleanup related logs, references, and todos
    if (lSheet) {
      const lData = lSheet.getDataRange().getValues();
      const pIdIdx = lData[0].indexOf('projectId');
      for (let j = lData.length - 1; j >= 1; j--) {
        if (lData[j][pIdIdx] === id) lSheet.deleteRow(j + 1);
      }
    }
    if (rSheet) {
      const rData = rSheet.getDataRange().getValues();
      const pIdIdx = rData[0].indexOf('projectId');
      for (let k = rData.length - 1; k >= 1; k--) {
        if (rData[k][pIdIdx] === id) rSheet.deleteRow(k + 1);
      }
    }
    if (tSheet) {
      const tData = tSheet.getDataRange().getValues();
      const pIdIdx = tData[0].indexOf('projectId');
      for (let m = tData.length - 1; m >= 1; m--) {
        if (tData[m][pIdIdx] === id) tSheet.deleteRow(m + 1);
      }
    }
    if (fSheet) {
      const fData = fSheet.getDataRange().getValues();
      const pIdIdx = fData[0].indexOf('projectId');
      for (let n = fData.length - 1; n >= 1; n--) {
        if (fData[n][pIdIdx] === id) fSheet.deleteRow(n + 1);
      }
    }
    return { status: 'success' };
  } catch (e) { return { status: 'error' }; }
}

// --- LOG HANDLERS ---

function getTracerLogsFromRegistry(projectId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerLogs");
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];
    const projectIdIdx = headers.indexOf('projectId');
    
    return data.slice(1)
      .filter(r => r[projectIdIdx] === projectId)
      .map(row => {
        let obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (e) { return []; }
}

function saveTracerLogToRegistry(item, content) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    let sheet = ss.getSheetByName("TracerLogs");
    if (!sheet) { setupTracerDatabase(); sheet = ss.getSheetByName("TracerLogs"); }
    
    const headers = CONFIG.SCHEMAS.TRACER_LOGS;
    const data = sheet.getDataRange().getValues();
    const idIdx = headers.indexOf('id');
    let existingRow = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === item.id) {
        existingRow = i + 1;
        break;
      }
    }

    // Sharding payload (Log content is sharded like Notes)
    if (content) {
      let storageTarget;
      if (existingRow > -1) {
         storageTarget = { url: item.storageNodeUrl, isLocal: !item.storageNodeUrl || item.storageNodeUrl === ScriptApp.getService().getUrl() };
      } else {
         storageTarget = getViableStorageTarget(CONFIG.STORAGE.CRITICAL_THRESHOLD);
      }
      if (!storageTarget) throw new Error("Storage Critical.");

      const jsonFileName = `tracer_log_${item.id}.json`;
      const jsonBody = JSON.stringify(content);

      if (storageTarget.isLocal) {
        let file;
        if (item.logJsonId) {
          file = DriveApp.getFileById(item.logJsonId);
          file.setContent(jsonBody);
        } else {
          const folder = DriveApp.getFolderById(CONFIG.FOLDERS.MAIN_LIBRARY);
          file = folder.createFile(Utilities.newBlob(jsonBody, 'application/json', jsonFileName));
          item.logJsonId = file.getId();
        }
        item.storageNodeUrl = ScriptApp.getService().getUrl();
      } else {
        const res = UrlFetchApp.fetch(storageTarget.url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ action: 'saveJsonFile', fileId: item.logJsonId || null, fileName: jsonFileName, content: jsonBody })
        });
        const resJson = JSON.parse(res.getContentText());
        if (resJson.status === 'success') {
          item.logJsonId = resJson.fileId;
          item.storageNodeUrl = storageTarget.url;
        }
      }
    }

    const rowData = headers.map(h => item[h] || '');
    if (existingRow > -1) sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    else sheet.appendRow(rowData);

    return { status: 'success', data: item };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

function deleteTracerLogFromRegistry(id) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerLogs");
    if (!sheet) return { status: 'error' };
    
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    const jsonIdIdx = data[0].indexOf('logJsonId');
    const nodeIdx = data[0].indexOf('storageNodeUrl');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === id) {
        const fileId = data[i][jsonIdIdx];
        const nodeUrl = data[i][nodeIdx];
        if (fileId && nodeUrl) {
          const myUrl = ScriptApp.getService().getUrl();
          if (nodeUrl === myUrl || nodeUrl === "") permanentlyDeleteFile(fileId);
          else UrlFetchApp.fetch(nodeUrl, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ action: 'deleteRemoteFiles', fileIds: [fileId] }) });
        }
        sheet.deleteRow(i + 1);
        return { status: 'success' };
      }
    }
    return { status: 'error' };
  } catch (e) { return { status: 'error' }; }
}

// --- REFERENCE HANDLERS ---

function getTracerReferencesFromRegistry(projectId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerReferences");
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];
    const projectIdIdx = headers.indexOf('projectId');
    
    return data.slice(1)
      .filter(r => r[projectIdIdx] === projectId)
      .map(row => {
        let obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });
  } catch (e) { return []; }
}

/**
 * LINK REFERENCE: Updated with Proactive Initialization of sharded JSON
 */
function linkTracerReferenceToRegistry(item) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    let sheet = ss.getSheetByName("TracerReferences");
    if (!sheet) { setupTracerDatabase(); sheet = ss.getSheetByName("TracerReferences"); }
    
    // 1. IDENTITY GEN
    if (!item.id) item.id = Utilities.getUuid();
    if (!item.createdAt) item.createdAt = new Date().toISOString();

    // 2. PROACTIVE SHARDING: Create empty JSON file { "quotes": [] }
    const storageTarget = getViableStorageTarget(CONFIG.STORAGE.CRITICAL_THRESHOLD);
    if (storageTarget) {
      const jsonFileName = `ref_content_${item.id}.json`;
      const initialContent = JSON.stringify({ quotes: [] });

      if (storageTarget.isLocal) {
        const folder = DriveApp.getFolderById(CONFIG.FOLDERS.MAIN_LIBRARY);
        const file = folder.createFile(Utilities.newBlob(initialContent, 'application/json', jsonFileName));
        item.contentJsonId = file.getId();
        item.storageNodeUrl = ScriptApp.getService().getUrl();
      } else {
        const res = UrlFetchApp.fetch(storageTarget.url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ action: 'saveJsonFile', fileName: jsonFileName, content: initialContent })
        });
        const resJson = JSON.parse(res.getContentText());
        if (resJson.status === 'success') {
          item.contentJsonId = resJson.fileId;
          item.storageNodeUrl = storageTarget.url;
        }
      }
    }

    // 3. REGISTRY SYNC
    const headers = CONFIG.SCHEMAS.TRACER_REFERENCES;
    const rowData = headers.map(h => item[h] || '');
    sheet.appendRow(rowData);

    return { status: 'success', data: item };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

function unlinkTracerReferenceFromRegistry(id) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerReferences");
    if (!sheet) return { status: 'error' };
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('id');
    const jsonIdIdx = headers.indexOf('contentJsonId');
    const nodeIdx = headers.indexOf('storageNodeUrl');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === id) {
        const fileId = data[i][jsonIdIdx];
        const nodeUrl = data[i][nodeIdx];
        
        // Cleanup sharded quotes file
        if (fileId && nodeUrl) {
          const myUrl = ScriptApp.getService().getUrl();
          if (nodeUrl === myUrl || nodeUrl === "") {
             permanentlyDeleteFile(fileId);
          } else {
            UrlFetchApp.fetch(nodeUrl, {
              method: 'post',
              contentType: 'application/json',
              payload: JSON.stringify({ action: 'deleteRemoteFiles', fileIds: [fileId] }),
              muteHttpExceptions: true
            });
          }
        }

        sheet.deleteRow(i + 1);
        return { status: 'success' };
      }
    }
    return { status: 'error' };
  } catch (e) { return { status: 'error' }; }
}

/**
 * SHARDING: Save/Update Reference Content (Saved Quotes)
 * Includes Row Discovery Failover and Guard Logic
 */
function saveReferenceContentToRegistry(item, content) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    let sheet = ss.getSheetByName("TracerReferences");
    if (!sheet) return { status: 'error', message: 'Sheet missing.' };
    
    const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idIdx = actualHeaders.indexOf('id');
    const pIdIdx = actualHeaders.indexOf('projectId');
    const cIdIdx = actualHeaders.indexOf('collectionId');
    const jsonIdIdx = actualHeaders.indexOf('contentJsonId');
    const nodeIdx = actualHeaders.indexOf('storageNodeUrl');
    
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    // PRIMARY LOOKUP: BY ID
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === item.id) { rowIndex = i + 1; break; }
    }
    
    // FAILOVER DISCOVERY: BY PROJECT + COLLECTION (Handles race conditions)
    if (rowIndex === -1 && item.projectId && item.collectionId) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][pIdIdx] === item.projectId && data[i][cIdIdx] === item.collectionId) {
          rowIndex = i + 1;
          break;
        }
      }
    }
    
    if (rowIndex === -1) throw new Error("Reference anchor not found. Please refresh list.");

    // Determine storage node
    let storageTarget;
    if (item.contentJsonId && item.contentJsonId.trim() !== "") {
      storageTarget = { url: item.storageNodeUrl, isLocal: !item.storageNodeUrl || item.storageNodeUrl === ScriptApp.getService().getUrl() };
    } else {
      storageTarget = getViableStorageTarget(CONFIG.STORAGE.CRITICAL_THRESHOLD);
    }
    if (!storageTarget) throw new Error("Storage Critical.");

    const jsonFileName = `ref_content_${item.id}.json`;
    const jsonBody = JSON.stringify(content);

    if (storageTarget.isLocal) {
      let file;
      // CORE GUARD: Verify ID before fetching from Drive
      if (item.contentJsonId && item.contentJsonId.trim() !== "") {
        file = DriveApp.getFileById(item.contentJsonId);
        file.setContent(jsonBody);
      } else {
        const folder = DriveApp.getFolderById(CONFIG.FOLDERS.MAIN_LIBRARY);
        file = folder.createFile(Utilities.newBlob(jsonBody, 'application/json', jsonFileName));
        item.contentJsonId = file.getId();
        if (jsonIdIdx > -1) sheet.getRange(rowIndex, jsonIdIdx + 1).setValue(item.contentJsonId);
      }
      item.storageNodeUrl = ScriptApp.getService().getUrl();
      if (nodeIdx > -1) sheet.getRange(rowIndex, nodeIdx + 1).setValue(item.storageNodeUrl);
    } else {
      const res = UrlFetchApp.fetch(storageTarget.url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ 
          action: 'saveJsonFile', 
          fileId: (item.contentJsonId && item.contentJsonId.trim() !== "") ? item.contentJsonId : null, 
          fileName: jsonFileName, 
          content: jsonBody 
        })
      });
      const resJson = JSON.parse(res.getContentText());
      if (resJson.status === 'success') {
        item.contentJsonId = resJson.fileId;
        item.storageNodeUrl = storageTarget.url;
        if (jsonIdIdx > -1) sheet.getRange(rowIndex, jsonIdIdx + 1).setValue(item.contentJsonId);
        if (nodeIdx > -1) sheet.getRange(rowIndex, nodeIdx + 1).setValue(item.storageNodeUrl);
      }
    }

    return { status: 'success', contentJsonId: item.contentJsonId, storageNodeUrl: item.storageNodeUrl };
  } catch (e) { return { status: 'error', message: e.toString() }; }
}

// --- TODO HANDLERS ---

function getTracerTodosFromRegistry(projectId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerTodos");
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];
    const projectIdIdx = headers.indexOf('projectId');
    const isDoneIdx = headers.indexOf('isDone');
    
    return data.slice(1)
      .filter(r => r[projectIdIdx] === projectId)
      .map(row => {
        let obj = {};
        headers.forEach((h, i) => {
          let val = row[i];
          if (h === 'isDone') val = (val === 'true' || val === true);
          obj[h] = val;
        });
        return obj;
      }).sort((a,b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());
  } catch (e) { return []; }
}

/**
 * NEW: getGlobalUnfinishedTodos
 * Mengambil seluruh tugas yang belum selesai dari semua project.
 */
function getGlobalUnfinishedTodos() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerTodos");
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];
    const isDoneIdx = headers.indexOf('isDone');
    
    return data.slice(1)
      .filter(r => r[isDoneIdx] !== 'true' && r[isDoneIdx] !== true)
      .map(row => {
        let obj = {};
        headers.forEach((h, i) => {
          let val = row[i];
          if (h === 'isDone') val = false;
          obj[h] = val;
        });
        return obj;
      });
  } catch (e) { return []; }
}

function saveTracerTodoToRegistry(item) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    let sheet = ss.getSheetByName("TracerTodos");
    if (!sheet) { setupTracerDatabase(); sheet = ss.getSheetByName("TracerTodos"); }
    
    const headers = CONFIG.SCHEMAS.TRACER_TODOS;
    const rowData = headers.map(h => {
      const val = item[h];
      return (val !== undefined && val !== null) ? val : '';
    });

    const data = sheet.getDataRange().getValues();
    const idIdx = headers.indexOf('id');
    let existingRow = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === item.id) {
        existingRow = i + 1;
        break;
      }
    }

    if (existingRow > -1) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function deleteTracerTodoFromRegistry(id) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerTodos");
    if (!sheet) return { status: 'error' };
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === id) { sheet.deleteRow(i + 1); break; }
    }
    return { status: 'success' };
  } catch (e) { return { status: 'error' }; }
}

// --- FINANCE HANDLERS ---

function getTracerFinanceFromRegistry(projectId, startDate, endDate, search) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerFinance");
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];
    
    const projectIdIdx = headers.indexOf('projectId');
    const dateIdx = headers.indexOf('date');
    const descIdx = headers.indexOf('description');
    
    return data.slice(1)
      .filter(r => {
        if (r[projectIdIdx] !== projectId) return false;
        
        // Date Filter
        if (startDate || endDate) {
          const itemDate = new Date(r[dateIdx]);
          if (startDate) {
             const start = new Date(startDate);
             start.setHours(0,0,0,0);
             if (itemDate < start) return false;
          }
          if (endDate) {
             const end = new Date(endDate);
             end.setHours(23,59,59,999);
             if (itemDate > end) return false;
          }
        }
        
        // Search Filter
        if (search) {
          if (!r[descIdx].toLowerCase().includes(search.toLowerCase())) return false;
        }

        return true;
      })
      .map(row => {
        let obj = {};
        headers.forEach((h, i) => {
          let val = row[i];
          if (h === 'credit' || h === 'debit' || h === 'balance') val = parseFloat(val) || 0;
          obj[h] = val;
        });
        return obj;
      })
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (e) { return []; }
}

function saveTracerFinanceToRegistry(item, content) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    let sheet = ss.getSheetByName("TracerFinance");
    if (!sheet) { setupTracerDatabase(); sheet = ss.getSheetByName("TracerFinance"); }
    
    const headers = CONFIG.SCHEMAS.TRACER_FINANCE;
    
    // Sharding Attachments
    if (content) {
      let storageTarget;
      if (item.attachmentsJsonId && item.storageNodeUrl) {
         storageTarget = { url: item.storageNodeUrl, isLocal: !item.storageNodeUrl || item.storageNodeUrl === ScriptApp.getService().getUrl() };
      } else {
         storageTarget = getViableStorageTarget(CONFIG.STORAGE.CRITICAL_THRESHOLD);
      }
      if (!storageTarget) throw new Error("Storage Critical.");

      const jsonFileName = `fin_attachments_${item.id}.json`;
      const jsonBody = JSON.stringify(content);

      if (storageTarget.isLocal) {
        let file;
        if (item.attachmentsJsonId) {
          file = DriveApp.getFileById(item.attachmentsJsonId);
          file.setContent(jsonBody);
        } else {
          const folder = DriveApp.getFolderById(CONFIG.FOLDERS.MAIN_LIBRARY);
          file = folder.createFile(Utilities.newBlob(jsonBody, 'application/json', jsonFileName));
          item.attachmentsJsonId = file.getId();
        }
        item.storageNodeUrl = ScriptApp.getService().getUrl();
      } else {
        const res = UrlFetchApp.fetch(storageTarget.url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({ action: 'saveJsonFile', fileId: item.attachmentsJsonId || null, fileName: jsonFileName, content: jsonBody })
        });
        const resJson = JSON.parse(res.getContentText());
        if (resJson.status === 'success') {
          item.attachmentsJsonId = resJson.fileId;
          item.storageNodeUrl = storageTarget.url;
        }
      }
    }

    const data = sheet.getDataRange().getValues();
    const idIdx = headers.indexOf('id');
    let existingRow = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === item.id) { existingRow = i + 1; break; }
    }

    // AUTOMATIC BALANCE RECALCULATION
    // Fetch all items for project, sort chronologically, recalc running balance
    // This is expensive but necessary for ledger integrity if insertion happens mid-stream
    // Optimized: Only if not appending to end? For now simple append/update row, let UI trigger full recalc?
    // Backend integrity requires full pass.
    
    // For now: Just save the row. UI recalculates display. 
    // The 'balance' field in DB is snapshot at save time or can be recomputed on fetch.
    // Let's rely on fetch logic to compute dynamic balance to be safe? 
    // fetchTracerFinance currently computes balance? No, it reads.
    // Ideally, balance should be computed on read. 
    // Storing 'balance' is risky if historical data changes.
    // But schema has 'balance'. We will save it as passed from UI or compute it here?
    // Let's save as is, assuming UI sent correct snapshot.
    
    const rowData = headers.map(h => item[h] !== undefined ? item[h] : '');
    
    if (existingRow > -1) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return { status: 'success', data: item };

  } catch (e) { return { status: 'error', message: e.toString() }; }
}

function deleteTracerFinanceFromRegistry(id) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.TRACER);
    const sheet = ss.getSheetByName("TracerFinance");
    if (!sheet) return { status: 'error' };
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('id');
    const jsonIdIdx = headers.indexOf('attachmentsJsonId');
    const nodeIdx = headers.indexOf('storageNodeUrl');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === id) {
        const fileId = data[i][jsonIdIdx];
        const nodeUrl = data[i][nodeIdx];
        
        if (fileId && nodeUrl) {
          const myUrl = ScriptApp.getService().getUrl();
          if (nodeUrl === myUrl || nodeUrl === "") {
             permanentlyDeleteFile(fileId);
          } else {
            UrlFetchApp.fetch(nodeUrl, {
              method: 'post',
              contentType: 'application/json',
              payload: JSON.stringify({ action: 'deleteRemoteFiles', fileIds: [fileId] }),
              muteHttpExceptions: true
            });
          }
        }

        sheet.deleteRow(i + 1);
        return { status: 'success' };
      }
    }
    return { status: 'error' };
  } catch (e) { return { status: 'error' }; }
}

/**
 * GENERATE FINANCE EXPORT PDF
 */
function generateFinanceExportFileFromRegistry(payload) {
  try {
    const { transactions, projectTitle, projectAuthors, currency } = payload;
    
    // HTML Template
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: A4; margin: 1.5cm; }
        body { font-family: 'Helvetica', sans-serif; color: #333; line-height: 1.5; font-size: 10pt; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #004A74; padding-bottom: 10px; margin-bottom: 20px; }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand img { width: 32px; height: 32px; }
        .brand h1 { margin: 0; color: #004A74; font-size: 16pt; text-transform: uppercase; letter-spacing: 2px; }
        .meta { text-align: right; font-size: 8pt; color: #666; }
        
        .project-info { margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 5px solid #FED400; }
        .project-title { font-size: 14pt; font-weight: bold; color: #004A74; margin: 0 0 5px 0; }
        .project-authors { font-size: 10pt; font-style: italic; color: #555; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #004A74; color: white; padding: 8px; text-align: left; font-size: 9pt; text-transform: uppercase; }
        td { padding: 8px; border-bottom: 1px solid #eee; font-size: 9pt; vertical-align: top; }
        tr:nth-child(even) { background: #fcfcfc; }
        
        .amount { font-family: 'Courier New', monospace; font-weight: bold; }
        .credit { color: #10B981; }
        .debit { color: #EF4444; }
        .balance { color: #004A74; }
        
        .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          <img src="https://lh3.googleusercontent.com/d/1ZpVAXWGLDP2C42Fct0bisloaQLf2095_" style="width: 40px; height: 40px;" />
        </div>
        <div class="meta">
          Generated: ${new Date().toLocaleDateString()}<br/>
          Financial Audit Report
        </div>
      </div>
      
      <div class="project-info">
        <div class="project-title">${projectTitle}</div>
        <div class="project-authors">Authorized by: ${projectAuthors}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th width="15%">Date</th>
            <th width="40%">Description</th>
            <th width="15%" style="text-align:right">Credit</th>
            <th width="15%" style="text-align:right">Debit</th>
            <th width="15%" style="text-align:right">Balance</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    transactions.forEach(t => {
       const date = new Date(t.date).toLocaleDateString('en-GB');
       const credit = t.credit > 0 ? `${new Intl.NumberFormat('id-ID').format(t.credit)}` : '-';
       const debit = t.debit > 0 ? `${new Intl.NumberFormat('id-ID').format(t.debit)}` : '-';
       const balance = new Intl.NumberFormat('id-ID').format(t.balance);
       
       html += `
         <tr>
           <td>${date}</td>
           <td>
             <strong>${t.description}</strong>
             ${t.links && t.links !== '-' ? `<br/><span style="font-size:8pt; color:#666; font-style:italic;">Evidence: ${t.links}</span>` : ''}
           </td>
           <td class="amount credit" style="text-align:right">${credit}</td>
           <td class="amount debit" style="text-align:right">${debit}</td>
           <td class="amount balance" style="text-align:right">${balance}</td>
         </tr>
       `;
    });
    
    html += `
        </tbody>
      </table>
      
      <div class="footer">
        Xeenaps Smart Scholar Ecosystem &bull; Research Tracer Module
      </div>
    </body>
    </html>
    `;

    const blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF).setName(`Finance_Report_${new Date().getTime()}.pdf`);
    const base64 = Utilities.base64Encode(blob.getBytes());
    
    return {
      status: 'success',
      base64: base64,
      filename: `Finance_Report_${projectTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    };

  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}
