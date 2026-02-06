/**
 * XEENAPS PKM - AI QUESTION BANK WORKER
 * VERSION: 3.2 (HARDENED EXTRACTION - SUPABASE READY)
 */

function setupQuestionDatabase() {
  return { status: 'success', message: 'Question metadata is now managed by Supabase.' };
}

/**
 * PURE AI WORKER: Generate soal via AI tanpa menulis ke Spreadsheet
 */
function handleGenerateQuestions(body) {
  try {
    const { collectionId, bloomLevel, customLabel, count, additionalContext, language, extractedJsonId, nodeUrl } = body;
    
    if (!extractedJsonId) throw new Error("Source text not found. Please re-extract item.");

    // 1. Ambil teks sumber
    let fullText = "";
    const myUrl = ScriptApp.getService().getUrl();
    const isLocal = !nodeUrl || nodeUrl === "" || nodeUrl === myUrl;

    if (isLocal) {
      const file = DriveApp.getFileById(extractedJsonId);
      const content = JSON.parse(file.getBlob().getDataAsString());
      fullText = content.fullText || "";
    } else {
      const remoteRes = UrlFetchApp.fetch(nodeUrl + (nodeUrl.indexOf('?') === -1 ? '?' : '&') + "action=getFileContent&fileId=" + extractedJsonId);
      const resJson = JSON.parse(remoteRes.getContentText());
      if (resJson.status === 'success') {
        const content = JSON.parse(resJson.content);
        fullText = content.fullText || "";
      }
    }

    if (!fullText) throw new Error("Could not retrieve source text.");

    // 2. Siapkan Prompt AI
    const contextSnippet = fullText.substring(0, 50000); 
    const prompt = `ACT AS A SENIOR PEDAGOGICAL ASSESSMENT SPECIALIST.
    YOUR TASK: Generate exactly ${count} high-validity multiple-choice questions based on the source text.
    
    PEDAGOGICAL FRAMEWORK: Bloom's Taxonomy Level: ${bloomLevel}.
    LANGUAGE: ${language || 'English'}.
    ADDITIONAL CONTEXT: ${additionalContext || 'None'}.

    --- CRITICAL MANDATORY RULES ---
    1. ANSWER KEY RANDOMIZATION: You MUST distribute the correct answer keys (A, B, C, D, E) UNIFORMLY across the generated set.
    2. VERBATIM REFERENCE (MANDATORY): For every correct answer, you MUST identify exactly one sentence from the source text that provides the factual basis.
    3. STRICT DATA MAPPING:
       - "reasoningDistractors" MUST ONLY contain entries for the 4 INCORRECT keys.
       - DO NOT include the "correctAnswer" key inside the "reasoningDistractors" object.
    4. QUESTION STRUCTURE: 5 options (A, B, C, D, E).
    5. OUTPUT: RAW JSON ONLY.

    --- JSON SCHEMA ---
    {
      "questions": [
        {
          "questionText": "...",
          "options": [{"key": "A", "text": "..."}, {"key": "B", "text": "..."}, ...],
          "correctAnswer": "Determined by your uniform distribution logic",
          "reasoningCorrect": "...",
          "reasoningDistractors": { "Key1": "...", "Key2": "...", "Key3": "...", "Key4": "..." },
          "verbatimReference": "Verbatim quote"
        }
      ]
    }

    TEXT TO ANALYZE:
    ${contextSnippet}`;

    const aiResult = callGeminiService(prompt);
    if (aiResult.status !== 'success') return aiResult;

    // --- ENHANCED REGEX JSON EXTRACTION ---
    let rawOutput = aiResult.data.trim();
    let cleanJson = "";
    
    // Mencari blok kurung kurawal paling luar untuk menghindari teks narasi AI
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    } else {
      throw new Error("AI response format invalid. No JSON object found.");
    }
    
    const parsed = JSON.parse(cleanJson);
    const questions = parsed.questions || parsed.data || parsed.results || [];
    
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("AI did not generate any questions in the expected format.");
    }
    
    // Stage 3: Defensive Mapping & Cleaning
    const outputQuestions = questions.map(q => {
      // Handle key hallucinations
      const qText = q.questionText || q.question_text || q.question || q.text || "Untitled Question";
      const qCorrect = String(q.correctAnswer || q.correct_answer || q.answer || "A").toUpperCase();
      const qRef = q.verbatimReference || q.verbatim_reference || q.reference || "-";
      const qReason = q.reasoningCorrect || q.reasoning_correct || q.rationale || "-";
      
      // Force valid options structure
      let qOptions = Array.isArray(q.options) ? q.options : [];
      if (qOptions.length < 5) {
        const keys = ['A', 'B', 'C', 'D', 'E'];
        keys.forEach(k => {
          if (!qOptions.some(o => o.key === k)) {
            qOptions.push({ key: k, text: "Additional analysis needed for this option." });
          }
        });
      }
      // Re-sort options A-E
      qOptions.sort((a,b) => a.key.localeCompare(b.key));

      // Clean distractors logic
      const cleanedDistractors = {};
      const rawDistractors = q.reasoningDistractors || q.reasoning_distractors || q.distractors || {};
      
      if (typeof rawDistractors === 'object' && rawDistractors !== null) {
        Object.keys(rawDistractors).forEach(k => {
          const upperKey = k.toUpperCase();
          if (upperKey !== qCorrect) {
            cleanedDistractors[upperKey] = rawDistractors[k];
          }
        });
      }

      return {
        id: Utilities.getUuid(),
        collectionId: collectionId,
        bloomLevel: bloomLevel,
        customLabel: customLabel || "AI Generated Set",
        questionText: qText,
        options: qOptions,
        correctAnswer: qCorrect,
        reasoningCorrect: qReason,
        reasoningDistractors: Object.keys(cleanedDistractors).length > 0 ? cleanedDistractors : {},
        verbatimReference: qRef,
        language: language,
        createdAt: new Date().toISOString()
      };
    });

    return { status: 'success', data: outputQuestions };

  } catch (e) {
    return { status: 'error', message: "AI Analysis Failed: " + e.message };
  }
}

function saveQuestionToRegistry(item) {
  return { status: 'error', message: 'Registry migrated to Supabase. Access denied via GAS.' };
}

function getAllQuestionsFromRegistry() {
  return { status: 'error', message: 'Registry migrated to Supabase.' };
}

function deleteQuestionFromRegistry(id) {
  return { status: 'success', message: 'Metadata deletion handled by Supabase. No physical cleanup required.' };
}