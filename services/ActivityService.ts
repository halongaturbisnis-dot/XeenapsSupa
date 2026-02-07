
import { ActivityItem, ActivityVaultItem, GASResponse } from '../types';
import { GAS_WEB_APP_URL } from '../constants';
import { 
  fetchActivitiesPaginatedFromSupabase, 
  upsertActivityToSupabase, 
  deleteActivityFromSupabase,
  fetchActivityByIdFromSupabase 
} from './ActivitySupabaseService';

/**
 * XEENAPS ACTIVITY SERVICE (HYBRID MIGRATION)
 * Metadata: Supabase
 * Storage: Google Apps Script (Drive)
 */

export const fetchActivitiesPaginated = async (
  page: number = 1,
  limit: number = 25,
  search: string = "",
  startDate: string = "",
  endDate: string = "",
  type: string = "All",
  signal?: AbortSignal
): Promise<{ items: ActivityItem[], totalCount: number }> => {
  // Direct call to Supabase Registry
  return await fetchActivitiesPaginatedFromSupabase(
    page, 
    limit, 
    search, 
    startDate, 
    endDate, 
    type, 
    "startDate", 
    "desc"
  );
};

export const saveActivity = async (item: ActivityItem): Promise<boolean> => {
  // SILENT BROADCAST FOR DASHBOARD
  window.dispatchEvent(new CustomEvent('xeenaps-activity-updated', { detail: item }));
  
  // Direct call to Supabase Registry
  return await upsertActivityToSupabase(item);
};

export const deleteActivity = async (id: string): Promise<boolean> => {
  // SILENT BROADCAST FOR DASHBOARD
  window.dispatchEvent(new CustomEvent('xeenaps-activity-deleted', { detail: id }));

  try {
    // 1. Fetch Item to get File IDs (Cert & Vault)
    const item = await fetchActivityByIdFromSupabase(id);
    
    // 2. Physical File Cleanup (Fire & Forget to GAS)
    if (item) {
      if (item.certificateFileId && item.certificateNodeUrl) {
         deleteRemoteFile(item.certificateFileId, item.certificateNodeUrl);
      }
      if (item.vaultJsonId && item.storageNodeUrl) {
         deleteRemoteFile(item.vaultJsonId, item.storageNodeUrl);
         // Note: Deep vault content cleanup (files inside vault) is complex in background 
         // without parsing JSON. We rely on 'Lazy Cleanup' or manual vault purge for now 
         // to keep UI snappy, or assume specific cleanup isn't critical for orphan files.
      }
    }

    // 3. Metadata Cleanup (Supabase)
    return await deleteActivityFromSupabase(id);

  } catch (e) {
    console.error("Delete Activity Failed:", e);
    return false;
  }
};

/**
 * Helper to permanently delete a file from a specific storage node
 */
export const deleteRemoteFile = async (fileId: string, nodeUrl: string): Promise<boolean> => {
  try {
    const res = await fetch(nodeUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteRemoteFiles', fileIds: [fileId] })
    });
    const result = await res.json();
    return result.status === 'success';
  } catch (e) {
    return false;
  }
};

/**
 * SHARDING: Fetch Vault JSON Content from Storage Node
 */
export const fetchVaultContent = async (vaultJsonId: string, nodeUrl?: string): Promise<ActivityVaultItem[]> => {
  if (!vaultJsonId) return [];
  try {
    const targetUrl = nodeUrl || GAS_WEB_APP_URL;
    if (!targetUrl) return [];
    const finalUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=getFileContent&fileId=${vaultJsonId}`;
    const response = await fetch(finalUrl);
    const result = await response.json();
    return result.status === 'success' ? JSON.parse(result.content) : [];
  } catch (e) {
    return [];
  }
};

/**
 * SHARDING: Update Vault JSON Content on Storage Node
 */
export const updateVaultContent = async (
  activityId: string, 
  vaultJsonId: string, 
  content: ActivityVaultItem[], 
  nodeUrl?: string
): Promise<{ success: boolean, newVaultId?: string, newNodeUrl?: string }> => {
  try {
    let targetUrl = nodeUrl || GAS_WEB_APP_URL!;
    
    // If we don't have a vault yet, ask the backend for a sharding target first
    if (!vaultJsonId && !nodeUrl) {
      const quotaRes = await fetch(`${GAS_WEB_APP_URL}?action=checkQuota`);
      // Quota management is handled on GAS side via action: 'saveJsonFile' logic 
      // but we ensure we are hitting the master first to let it decide if it needs to proxy.
    }

    const res = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'saveJsonFile', 
        fileId: vaultJsonId, 
        fileName: `vault_${activityId}.json`,
        content: JSON.stringify(content) 
      })
    });
    const result = await res.json();
    return { 
      success: result.status === 'success', 
      newVaultId: result.fileId,
      newNodeUrl: targetUrl 
    };
  } catch (e) {
    return { success: false };
  }
};

/**
 * Dynamic Sharded Binary Upload for Vault
 * Returns both fileId and nodeUrl where the file was actually stored
 */
export const uploadVaultFile = async (file: File): Promise<{ fileId: string, nodeUrl: string } | null> => {
  if (!GAS_WEB_APP_URL) return null;
  
  const reader = new FileReader();
  const base64Data = await new Promise<string>((resolve) => {
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  try {
    const response = await fetch(GAS_WEB_APP_URL, { 
      method: 'POST', 
      body: JSON.stringify({ 
        action: 'vaultFileUpload', 
        fileData: base64Data, 
        fileName: file.name, 
        mimeType: file.type 
      })
    });
    const result = await response.json();
    return result.status === 'success' ? { fileId: result.fileId, nodeUrl: result.nodeUrl } : null;
  } catch (e) {
    return null;
  }
};