/**
 * XEENAPS PKM - CONSULTATION STORAGE WORKER
 * NOTE: Registry Metadata has moved to Supabase.
 * This module now handles Physical File Sharding (JSON) only.
 */

function setupConsultationDatabase() {
  return { status: 'success', message: 'Consultation Metadata is now managed by Supabase.' };
}

/**
 * Worker: Save Consultation Content (JSON) to Drive (Sharding)
 * Returns fileId and nodeUrl for Supabase Registry.
 */
function saveConsultationContentToDrive(item, answerContent) {
  try {
    // 1. Determine Storage Node (Master vs Slave)
    // Supports Total Rewrite if fileId exists
    let storageTarget;
    if (item.answerJsonId && item.nodeUrl) {
       // Re-consult overwrite: Use existing node
       storageTarget = { 
         url: item.nodeUrl, 
         isLocal: !item.nodeUrl || item.nodeUrl === ScriptApp.getService().getUrl() 
       };
    } else {
       // New Consult: Find available node
       storageTarget = getViableStorageTarget(CONFIG.STORAGE.CRITICAL_THRESHOLD);
    }

    if (!storageTarget) throw new Error("Storage Critical: No viable node found.");

    const jsonFileName = `consult_${item.id}.json`;
    const jsonBody = JSON.stringify(answerContent);

    let fileId = item.answerJsonId;
    let nodeUrl = item.nodeUrl;

    if (storageTarget.isLocal) {
      // Local Write
      if (fileId) {
        // Overwrite
        const file = DriveApp.getFileById(fileId);
        file.setContent(jsonBody);
      } else {
        // Create New
        const folder = DriveApp.getFolderById(CONFIG.FOLDERS.MAIN_LIBRARY);
        const file = folder.createFile(Utilities.newBlob(jsonBody, 'application/json', jsonFileName));
        fileId = file.getId();
      }
      nodeUrl = ScriptApp.getService().getUrl();
    } else {
      // Remote Write (Slave)
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
      nodeUrl: nodeUrl
    };

  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}
