/**
 * XEENAPS PKM - PRESENTATION WORKER MODULE (PURE WORKER)
 */

/**
 * Worker: Memproses file PPTX fisik dan mengonversi ke Google Slides.
 * Tidak lagi menulis metadata ke Google Sheets.
 */
function handleSavePresentation(body) {
  try {
    const { presentation, pptxFileData } = body;
    
    // 1. Storage Node Determination
    let storageTarget;
    if (body.folderId) {
      storageTarget = {
        url: ScriptApp.getService().getUrl(),
        folderId: body.folderId,
        isLocal: true
      };
    } else {
      storageTarget = getViableStorageTarget(CONFIG.STORAGE.THRESHOLD);
    }
    
    if (!storageTarget) throw new Error("Storage full on all nodes.");

    // Delegasi ke Slave jika diperlukan
    if (!storageTarget.isLocal) {
      const res = UrlFetchApp.fetch(storageTarget.url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          action: 'savePresentation',
          presentation: presentation,
          pptxFileData: pptxFileData,
          folderId: storageTarget.folderId
        })
      });
      return JSON.parse(res.getContentText());
    }

    // 2. Simpan file PPTX fisik (Backup)
    const fileName = `${presentation.title}.pptx`;
    const blob = Utilities.newBlob(Utilities.base64Decode(pptxFileData), 'application/vnd.openxmlformats-officedocument.presentationml.presentation', fileName);
    
    const folder = DriveApp.getFolderById(storageTarget.folderId);
    const pptxFile = folder.createFile(blob);

    // 3. Konversi ke Google Slides (Premium Archiving)
    const resource = {
      name: presentation.title || "Xeenaps Elegant Presentation",
      mimeType: MimeType.GOOGLE_SLIDES,
      parents: [storageTarget.folderId]
    };
    
    const convertedFile = Drive.Files.create(resource, blob);
    
    // Return Worker Metadata to Frontend for Supabase Registry
    return { 
      status: 'success', 
      data: {
        gSlidesId: convertedFile.id,
        storageNodeUrl: storageTarget.url
      }
    };
  } catch (e) {
    console.error("Save Presentation Worker Error: " + e.toString());
    return { status: 'error', message: e.toString() };
  }
}

/**
 * Worker: Menghapus file fisik Google Slides.
 */
function deletePresentationRecord(id) {
  try {
    // NOTE: Karena GAS tidak lagi memegang registry, ID file fisik harus dipassing dari frontend
    // Namun untuk kompatibilitas, kita tetap menerima ID sharding jika metadata tersedia di Drive.
    // Frontend Xeenaps sekarang memanggil deleteRemoteFiles secara langsung via deletePresentation logic.
    return { status: 'success', message: 'Worker received cleanup command.' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}