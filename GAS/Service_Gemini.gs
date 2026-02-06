/**
 * XEENAPS PKM - GEMINI AI SERVICE V20 (SMART URL ROUTING)
 */

function callGeminiService(prompt, modelOverride) {
  const keys = getKeysFromSheet('ApiKeys', 2); // Column B
  if (!keys || keys.length === 0) return { status: 'error', message: 'No Gemini API keys found in spreadsheet KEYS sheet ApiKeys Col B.' };

  const config = getProviderModel('GEMINI');
  const rawModel = modelOverride || config.model;

  for (let key of keys) {
    try {
      // SMART URL DETECTION
      let url = "";
      if (rawModel.startsWith('http')) {
        // If Column B is a full URL
        const separator = rawModel.indexOf('?') === -1 ? '?' : '&';
        url = `${rawModel}${separator}key=${key}`;
      } else {
        // Fallback for simple model names
        url = `https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent?key=${key}`;
      }

      const payload = { contents: [{ parts: [{ text: prompt }] }] };
      
      const res = UrlFetchApp.fetch(url, { 
        method: "post", 
        contentType: "application/json", 
        payload: JSON.stringify(payload), 
        muteHttpExceptions: true,
        timeoutInSeconds: 120 // Extended for V19/V20 context depth
      });
      
      const responseData = JSON.parse(res.getContentText());
      
      if (responseData.candidates && responseData.candidates.length > 0) {
        const candidate = responseData.candidates[0];
        // SAFETY GUARD: Check if content and parts exist
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          const responseText = candidate.content.parts[0].text;
          return { status: 'success', data: responseText };
        } else {
          // Handle specific finish reasons
          const reason = candidate.finishReason || "UNKNOWN";
          if (reason === 'SAFETY') {
            throw new Error("Content blocked by Gemini Safety Filters. Try a less sensitive prompt or lower Bloom level.");
          }
          throw new Error("AI returned empty content. Finish Reason: " + reason);
        }
      } else if (responseData.error) {
        throw new Error(responseData.error.message || "Gemini API Internal Error");
      }
    } catch (err) {
      console.log("Gemini rotation: " + err.toString());
      // Re-throw if it's the last key to show the specific error
      if (key === keys[keys.length - 1]) {
        return { status: 'error', message: err.toString() };
      }
    }
  }
  return { status: 'error', message: 'Gemini Synthesis Interrupted. Service exhausted all available keys.' };
}