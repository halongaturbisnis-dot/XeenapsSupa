
/**
 * XEENAPS PKM - API KEY MANAGER MODULE
 * Handles CRUD operations for Gemini, Groq, and ScrapingAnt keys in 'KEYS' Spreadsheet
 */

function handleApiKeyManager(payload) {
  // Determine specific operation
  const subAction = payload.action_type || payload.subAction; 
  
  try {
    if (subAction === 'get_keys') {
      return getApiKeys();
    }
    
    if (subAction === 'add_gemini') {
      return addGeminiKey(payload.key, payload.label);
    }
    
    if (subAction === 'delete_gemini') {
      return deleteGeminiKey(payload.id);
    }
    
    if (subAction === 'add_groq') {
      return addGroqKey(payload.api);
    }
    
    if (subAction === 'delete_groq') {
      return deleteGroqKey(payload.id);
    }
    
    if (subAction === 'save_scraping') {
      return saveScrapingKey(payload.key);
    }

    return { status: 'error', message: 'Unknown sub-action: ' + subAction };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

/**
 * Get All Keys for UI
 */
function getApiKeys() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.KEYS);
  
  // 1. Gemini Keys
  let geminiData = [];
  const geminiSheet = ss.getSheetByName("ApiKeys");
  if (geminiSheet) {
    const data = geminiSheet.getDataRange().getValues();
    // Headers: id, key, label, status, addedAt
    if (data.length > 1) {
      const headers = data[0];
      const idIdx = headers.indexOf('id');
      const keyIdx = headers.indexOf('key');
      const labelIdx = headers.indexOf('label');
      const statusIdx = headers.indexOf('status');
      const dateIdx = headers.indexOf('addedAt');
      
      geminiData = data.slice(1).map(r => ({
        id: r[idIdx],
        key: r[keyIdx],
        label: r[labelIdx],
        status: r[statusIdx],
        addedAt: r[dateIdx]
      }));
    }
  }

  // 2. Groq Keys
  let groqData = [];
  const groqSheet = ss.getSheetByName("Groq");
  if (groqSheet) {
    const data = groqSheet.getDataRange().getValues();
    // Headers: ID, API
    if (data.length > 1) {
      groqData = data.slice(1).map(r => ({
        id: r[0],
        api: r[1]
      }));
    }
  }

  // 3. Scraping Key
  let scrapingKey = "";
  const scrapSheet = ss.getSheetByName("Scraping");
  if (scrapSheet) {
    scrapingKey = scrapSheet.getRange("A1").getValue();
  }

  return { 
    status: 'success', 
    data: {
      gemini: geminiData,
      groq: groqData,
      scraping: scrapingKey
    }
  };
}

/**
 * Add Gemini Key
 */
function addGeminiKey(key, label) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.KEYS);
  let sheet = ss.getSheetByName("ApiKeys");
  if (!sheet) {
    sheet = ss.insertSheet("ApiKeys");
    sheet.appendRow(["id", "key", "label", "status", "addedAt"]);
  }
  
  const id = Utilities.getUuid();
  const timestamp = new Date().toISOString();
  
  sheet.appendRow([id, key, label, "active", timestamp]);
  return { status: 'success' };
}

/**
 * Delete Gemini Key
 */
function deleteGeminiKey(id) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.KEYS);
  const sheet = ss.getSheetByName("ApiKeys");
  if (!sheet) return { status: 'error', message: 'Sheet not found' };
  
  const data = sheet.getDataRange().getValues();
  // Assuming ID is column A (index 0)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'ID not found' };
}

/**
 * Add Groq Key
 */
function addGroqKey(api) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.KEYS);
  let sheet = ss.getSheetByName("Groq");
  if (!sheet) {
    sheet = ss.insertSheet("Groq");
    sheet.appendRow(["ID", "API"]);
  }
  
  const id = Utilities.getUuid();
  sheet.appendRow([id, api]);
  return { status: 'success' };
}

/**
 * Delete Groq Key
 */
function deleteGroqKey(id) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.KEYS);
  const sheet = ss.getSheetByName("Groq");
  if (!sheet) return { status: 'error', message: 'Sheet not found' };
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { status: 'success' };
    }
  }
  return { status: 'error', message: 'ID not found' };
}

/**
 * Save Scraping Key (Single Cell)
 */
function saveScrapingKey(key) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEETS.KEYS);
  let sheet = ss.getSheetByName("Scraping");
  if (!sheet) {
    sheet = ss.insertSheet("Scraping");
  }
  
  // Always overwrite A1
  sheet.getRange("A1").setValue(key);
  return { status: 'success' };
}
