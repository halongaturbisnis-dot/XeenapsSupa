
import { TracerProject, TracerLog, TracerReference, TracerReferenceContent, TracerTodo, TracerFinanceItem, TracerFinanceContent, GASResponse } from '../types';
import { GAS_WEB_APP_URL } from '../constants';
import { 
  fetchTracerProjectsFromSupabase, 
  upsertTracerProjectToSupabase, 
  deleteTracerProjectFromSupabase,
  fetchTracerLogsFromSupabase,
  upsertTracerLogToSupabase,
  deleteTracerLogFromSupabase,
  fetchTracerReferencesFromSupabase,
  upsertTracerReferenceToSupabase,
  deleteTracerReferenceFromSupabase,
  fetchTracerTodosFromSupabase,
  upsertTracerTodoToSupabase,
  deleteTracerTodoFromSupabase,
  fetchTracerFinanceFromSupabase,
  upsertTracerFinanceToSupabase,
  deleteTracerFinanceFromSupabase
} from './TracerSupabaseService';
import { deleteRemoteFile, fetchVaultContent } from './ActivityService';
import { fetchFileContent } from './gasService';

/**
 * XEENAPS TRACER SERVICE (HYBRID ARCHITECTURE)
 * Metadata: Supabase
 * Payload: Google Apps Script (Sharding)
 */

// --- 1. PROJECTS ---

export const fetchTracerProjects = async (
  page: number = 1,
  limit: number = 25,
  search: string = "",
  signal?: AbortSignal
): Promise<{ items: TracerProject[], totalCount: number }> => {
  return await fetchTracerProjectsFromSupabase(page, limit, search, "updatedAt", "desc");
};

export const saveTracerProject = async (item: TracerProject): Promise<boolean> => {
  // SILENT BROADCAST
  window.dispatchEvent(new CustomEvent('xeenaps-tracer-updated', { detail: item }));
  return await upsertTracerProjectToSupabase(item);
};

export const deleteTracerProject = async (id: string): Promise<boolean> => {
  // SILENT BROADCAST
  window.dispatchEvent(new CustomEvent('xeenaps-tracer-deleted', { detail: id }));
  return await deleteTracerProjectFromSupabase(id);
};

// --- 2. LOGS ---

export const fetchTracerLogs = async (projectId: string): Promise<TracerLog[]> => {
  return await fetchTracerLogsFromSupabase(projectId);
};

export const saveTracerLog = async (item: TracerLog, content: { description: string }): Promise<boolean> => {
  if (!GAS_WEB_APP_URL) return false;
  
  try {
    let updatedItem = { ...item };

    // 1. Sharding Content to GAS
    if (content) {
      const res = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'saveJsonFile', // Generic GAS action
          fileId: item.logJsonId || null,
          fileName: `tracer_log_${item.id}.json`,
          content: JSON.stringify(content),
          folderId: null // Uses default folder
        })
      });
      const result = await res.json();
      
      if (result.status === 'success') {
        updatedItem.logJsonId = result.fileId;
        updatedItem.storageNodeUrl = result.nodeUrl || GAS_WEB_APP_URL; // Update Node URL
      } else {
        throw new Error("Failed to save log content to drive.");
      }
    }

    // 2. Save Metadata to Supabase
    return await upsertTracerLogToSupabase(updatedItem);

  } catch (e) {
    console.error("Save Tracer Log Failed:", e);
    return false;
  }
};

export const deleteTracerLog = async (id: string): Promise<boolean> => {
  // Optional: Fetch item to clean up file if ID known. 
  // For now, metadata deletion is prioritized.
  return await deleteTracerLogFromSupabase(id);
};

// --- 3. REFERENCES ---

export const fetchTracerReferences = async (projectId: string): Promise<TracerReference[]> => {
  return await fetchTracerReferencesFromSupabase(projectId);
};

export const linkTracerReference = async (item: Partial<TracerReference>): Promise<TracerReference | null> => {
  try {
    const newRef: TracerReference = {
      id: item.id || crypto.randomUUID(),
      projectId: item.projectId || '',
      collectionId: item.collectionId || '',
      contentJsonId: '',
      storageNodeUrl: '',
      createdAt: new Date().toISOString()
    };
    
    const success = await upsertTracerReferenceToSupabase(newRef);
    return success ? newRef : null;
  } catch (e) {
    return null;
  }
};

export const unlinkTracerReference = async (id: string): Promise<boolean> => {
  return await deleteTracerReferenceFromSupabase(id);
};

/**
 * SHARDING: Reference Content (Quotes)
 */
export const fetchReferenceContent = async (contentJsonId: string, nodeUrl?: string): Promise<TracerReferenceContent | null> => {
  if (!contentJsonId) return null;
  try {
    const targetUrl = nodeUrl || GAS_WEB_APP_URL;
    if (!targetUrl) return null;
    const finalUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getFileContent&fileId=${contentJsonId}`;
    const response = await fetch(finalUrl);
    const result = await response.json();
    return result.status === 'success' ? JSON.parse(result.content) : null;
  } catch (e) {
    return null;
  }
};

export const saveReferenceContent = async (item: TracerReference, content: TracerReferenceContent): Promise<{contentJsonId: string, storageNodeUrl: string} | null> => {
  if (!GAS_WEB_APP_URL) return null;
  
  try {
    // 1. Sharding Content
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'saveJsonFile', 
        fileId: item.contentJsonId || null,
        fileName: `ref_content_${item.id}.json`,
        content: JSON.stringify(content)
      })
    });
    const result = await res.json();
    
    if (result.status === 'success') {
       // 2. Update Metadata Registry
       const updatedItem = {
         ...item,
         contentJsonId: result.fileId,
         storageNodeUrl: result.nodeUrl || GAS_WEB_APP_URL
       };
       await upsertTracerReferenceToSupabase(updatedItem);
       
       return { contentJsonId: result.fileId, storageNodeUrl: updatedItem.storageNodeUrl };
    }
    return null;
  } catch (e) {
    return null;
  }
};

// --- 4. TODOS ---

export const fetchTracerTodos = async (projectId: string): Promise<TracerTodo[]> => {
  return await fetchTracerTodosFromSupabase(projectId);
};

export const saveTracerTodo = async (item: TracerTodo): Promise<boolean> => {
  // SILENT BROADCAST
  window.dispatchEvent(new CustomEvent('xeenaps-todo-updated', { detail: item }));
  return await upsertTracerTodoToSupabase(item);
};

export const deleteTracerTodo = async (id: string): Promise<boolean> => {
  // SILENT BROADCAST
  window.dispatchEvent(new CustomEvent('xeenaps-todo-deleted', { detail: id }));
  return await deleteTracerTodoFromSupabase(id);
};

// --- 5. FINANCE ---

export const fetchTracerFinance = async (projectId: string, startDate = "", endDate = "", search = ""): Promise<TracerFinanceItem[]> => {
  return await fetchTracerFinanceFromSupabase(projectId, startDate, endDate, search);
};

/**
 * EXPORT PDF LOGIC (Hybrid Stitching)
 * 1. Fetch metadata from Supabase
 * 2. Calculate Running Balance
 * 3. Fetch attachments info (sharded JSON)
 * 4. Construct payload
 * 5. POST payload to GAS PDF Engine
 */
export const exportFinanceLedger = async (projectId: string, currency: string): Promise<{ base64: string, filename: string } | null> => {
  if (!GAS_WEB_APP_URL) return null;
  try {
     // 1. Fetch Finance Items (All)
     const financeItems = await fetchTracerFinanceFromSupabase(projectId);
     if (financeItems.length === 0) return null;

     // 2. Calculate Running Balance for Export
     // Ensure items are sorted chronologically before calculating
     const sortedItems = [...financeItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
     let runningBalance = 0;
     const calculatedItems = sortedItems.map(item => {
         runningBalance += (item.credit || 0) - (item.debit || 0);
         return { ...item, balance: runningBalance };
     });

     // 3. Fetch Project Info
     const { items: projects } = await fetchTracerProjectsFromSupabase(1, 1000, ""); 
     const project = projects.find(p => p.id === projectId);
     const projectTitle = project?.title || project?.label || "Financial Report";
     const projectAuthors = Array.isArray(project?.authors) ? project.authors.join(", ") : "Xeenaps User";

     // 4. Enrich Items with Attachment Links (Async Batch)
     const enrichedTransactions = await Promise.all(calculatedItems.map(async (item) => {
        let linkString = "-";
        if (item.attachmentsJsonId) {
           try {
              const content = await fetchFileContent(item.attachmentsJsonId, item.storageNodeUrl);
              if (content && Array.isArray(content.attachments)) {
                 const urls = content.attachments.map((a: any) => 
                    a.url || (a.fileId ? `https://drive.google.com/file/d/${a.fileId}/view` : "")
                 ).filter((u: string) => u !== "");
                 if (urls.length > 0) linkString = urls.join(" | ");
              }
           } catch (e) { console.warn("Failed to fetch attachment for export", e); }
        }
        return { ...item, links: linkString };
     }));

     // 5. Construct Payload
     const payload = {
        transactions: enrichedTransactions,
        projectTitle,
        projectAuthors,
        currency
     };

     // 6. Send to GAS
     const res = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({
           action: 'generateFinanceExport',
           payload: payload
        })
     });
     
     const result = await res.json();
     if (result.status === 'success') {
        return { base64: result.base64, filename: result.filename };
     }
     return null;
  } catch (e) {
    console.error("Finance Export Error:", e);
    return null;
  }
};

export const saveTracerFinance = async (item: TracerFinanceItem, content: TracerFinanceContent): Promise<boolean> => {
  if (!GAS_WEB_APP_URL) return false;
  
  try {
    let updatedItem = { ...item };

    // 1. Sharding Content (Attachments)
    if (content) {
      const res = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'saveJsonFile', 
          fileId: item.attachmentsJsonId || null,
          fileName: `fin_attachments_${item.id}.json`,
          content: JSON.stringify(content)
        })
      });
      const result = await res.json();
      
      if (result.status === 'success') {
         updatedItem.attachmentsJsonId = result.fileId;
         updatedItem.storageNodeUrl = result.nodeUrl || GAS_WEB_APP_URL;
      }
    }

    // 2. Save Metadata to Supabase
    return await upsertTracerFinanceToSupabase(updatedItem);
  } catch (e) {
    return false;
  }
};

export const deleteTracerFinance = async (id: string): Promise<GASResponse<any>> => {
  const success = await deleteTracerFinanceFromSupabase(id);
  return { status: success ? 'success' : 'error' };
};

// --- AI TRACER PROXIES (Passthrough to GAS) ---

export const extractTracerQuotes = async (collectionId: string, contextQuery: string): Promise<Array<{ originalText: string; enhancedText: string }> | null> => {
  if (!GAS_WEB_APP_URL) return null;
  try {
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'aiTracerProxy', 
        subAction: 'extractQuote', 
        payload: { collectionId, contextQuery } 
      })
    });
    const result = await res.json();
    return result.status === 'success' ? result.data : null;
  } catch (e) {
    return null;
  }
};

export const enhanceTracerQuote = async (originalText: string, citation: string): Promise<string | null> => {
  if (!GAS_WEB_APP_URL) return null;
  try {
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'aiTracerProxy', 
        subAction: 'enhanceQuote', 
        payload: { originalText, citation } 
      })
    });
    const result = await res.json();
    return result.status === 'success' ? result.data : null;
  } catch (e) {
    return null;
  }
};
