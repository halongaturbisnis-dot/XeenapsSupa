
import { TeachingItem, TeachingVaultItem, GASResponse } from '../types';
import { GAS_WEB_APP_URL } from '../constants';
import { 
  fetchTeachingPaginatedFromSupabase, 
  upsertTeachingToSupabase, 
  deleteTeachingFromSupabase 
} from './TeachingSupabaseService';

/**
 * XEENAPS TEACHING SERVICE (HYBRID ARCHITECTURE)
 * Metadata: Supabase
 * Storage: GAS
 */

export const fetchTeachingPaginated = async (
  page: number = 1,
  limit: number = 25,
  search: string = "",
  startDate: string = "",
  endDate: string = "",
  signal?: AbortSignal
): Promise<{ items: TeachingItem[], totalCount: number }> => {
  // Direct call to Supabase Registry
  return await fetchTeachingPaginatedFromSupabase(
    page, 
    limit, 
    search, 
    startDate, 
    endDate
  );
};

export const saveTeachingItem = async (item: TeachingItem): Promise<boolean> => {
  // SILENT BROADCAST FOR DASHBOARD
  window.dispatchEvent(new CustomEvent('xeenaps-teaching-updated', { detail: item }));

  // Direct call to Supabase Registry
  return await upsertTeachingToSupabase(item);
};

export const deleteTeachingItem = async (id: string): Promise<boolean> => {
  // SILENT BROADCAST FOR DASHBOARD
  window.dispatchEvent(new CustomEvent('xeenaps-teaching-deleted', { detail: id }));

  // Metadata Cleanup (Supabase)
  // Note: Physical file cleanup can be added here if needed using fetchTeachingById and deleteRemoteFile pattern
  return await deleteTeachingFromSupabase(id);
};

/**
 * VAULT: Fetch Teaching Documentation Vault (Kept on GAS for Physical Files)
 */
export const fetchTeachingVaultContent = async (vaultJsonId: string, nodeUrl?: string): Promise<TeachingVaultItem[]> => {
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
 * VAULT: Update Teaching Vault JSON (Kept on GAS)
 */
export const updateTeachingVaultContent = async (
  teachingId: string, 
  vaultJsonId: string, 
  content: TeachingVaultItem[], 
  nodeUrl?: string
): Promise<{ success: boolean, newVaultId?: string, newNodeUrl?: string }> => {
  try {
    let targetUrl = nodeUrl || GAS_WEB_APP_URL!;
    const res = await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'saveJsonFile', 
        fileId: vaultJsonId, 
        fileName: `teaching_vault_${teachingId}.json`,
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