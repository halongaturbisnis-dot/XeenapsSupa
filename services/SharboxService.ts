import { SharboxItem, LibraryItem, GASResponse, ColleagueItem, SharboxStatus } from '../types';
import { GAS_WEB_APP_URL } from '../constants';
import { 
  fetchInboxFromSupabase, 
  fetchSentFromSupabase, 
  upsertInboxItemToSupabase, 
  upsertSentItemToSupabase, 
  deleteInboxItemFromSupabase,
  deleteSentItemFromSupabase 
} from './SharboxSupabaseService';
import { upsertLibraryItemToSupabase } from './LibrarySupabaseService';

/**
 * XEENAPS SHARBOX SERVICE (HYBRID ARCHITECTURE)
 * - Inbox: Reads from Supabase. Background syncs from GAS Sheet.
 * - Sent: Writes to Supabase (History) + GAS (Transport). Reads from Supabase.
 */

export const initializeSharboxDatabase = async (): Promise<{ status: string; message: string }> => {
  try {
    // This still initializes the Google Sheet Inbox which acts as the physical mailbox
    const response = await fetch(GAS_WEB_APP_URL!, {
      method: 'POST',
      body: JSON.stringify({ action: 'setupSharboxDatabase' }),
    });
    return await response.json();
  } catch (error: any) {
    return { status: 'error', message: error.toString() };
  }
};

export const fetchSharboxItems = async (type: 'Inbox' | 'Sent'): Promise<SharboxItem[]> => {
  // Direct call to Supabase Registry
  if (type === 'Inbox') {
    return await fetchInboxFromSupabase();
  } else {
    return await fetchSentFromSupabase();
  }
};

/**
 * SYNC ENGINE: Fetches buffer from GAS -> Saves to Supabase -> Clears GAS buffer.
 * Should be called periodically or on app load.
 */
export const syncInboxBackground = async (): Promise<void> => {
  if (!GAS_WEB_APP_URL) return;

  try {
    // 1. Fetch Buffer from GAS
    const res = await fetch(`${GAS_WEB_APP_URL}?action=getInboxBuffer`);
    const json = await res.json();
    
    if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
      const bufferItems: SharboxItem[] = json.data;
      const syncedIds: string[] = [];

      // 2. Persist to Supabase
      for (const item of bufferItems) {
        const success = await upsertInboxItemToSupabase(item);
        if (success) {
          syncedIds.push(item.id);
        }
      }

      // 3. Clear successfully synced items from GAS Buffer
      if (syncedIds.length > 0) {
        await fetch(GAS_WEB_APP_URL, {
          method: 'POST',
          body: JSON.stringify({ 
            action: 'clearInboxBuffer', 
            ids: syncedIds 
          })
        });
        
        // Trigger UI refresh
        window.dispatchEvent(new CustomEvent('xeenaps-notif-refresh'));
      }
    }
  } catch (e) {
    console.error("Inbox Sync Failed:", e);
  }
};

export const shareToColleague = async (
  targetUniqueAppId: string, 
  receiverName: string, 
  receiverPhotoUrl: string,
  message: string,
  item: LibraryItem,
  receiverContacts?: { email?: string, phone?: string, socialMedia?: string }
): Promise<boolean> => {
  if (!GAS_WEB_APP_URL) return false;
  
  const timestamp = new Date().toISOString();
  const transactionId = crypto.randomUUID();

  try {
    // 1. Transport via GAS (To Receiver's Sheet)
    // Note: GAS uses its own UUID generation internally for the row ID, 
    // but to keep consistency, we might rely on GAS return or just fire-and-forget.
    // However, for correct local history, we should probably construct the object here.
    // The current GAS 'handleSendToSharbox' generates an ID. 
    // To properly track it, we should let GAS do it, or we rely on the fact that 'Sent' 
    // is local history.
    
    // We will call GAS. GAS will return success.
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'sendToSharbox', 
        targetUniqueAppId, 
        receiverName, 
        receiverPhotoUrl,
        message,
        item,
        receiverContacts
      })
    });
    const result = await res.json();

    if (result.status === 'success') {
      // 2. Save to Local Supabase History (Sent Box)
      const sentItem: SharboxItem = {
        ...item,
        id: transactionId, // Generate ID locally for our record
        receiverName,
        receiverPhotoUrl,
        receiverUniqueAppId: targetUniqueAppId,
        receiverEmail: receiverContacts?.email,
        receiverPhone: receiverContacts?.phone,
        receiverSocialMedia: receiverContacts?.socialMedia,
        message,
        timestamp,
        status: SharboxStatus.SENT,
        id_item: item.id
      };

      await upsertSentItemToSupabase(sentItem);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const claimSharboxItem = async (transactionId: string): Promise<boolean> => {
  // 1. Get item from Supabase Inbox (Since we sync first)
  // Actually, we usually have the item object in the UI.
  // But to be safe, we query Supabase list or rely on passed item.
  // This function signature only takes ID.
  
  // We need to fetch the item details to save it to Library.
  // Supabase 'fetchInboxFromSupabase' returns all. We can't filter by ID easily without extra call.
  // Let's assume the UI passes the ID, we find it in the list (if we cached it).
  // But here we need to fetch it.
  
  try {
    const inbox = await fetchInboxFromSupabase();
    const itemToClaim = inbox.find(i => i.id === transactionId);
    
    if (!itemToClaim) return false;
    if (itemToClaim.status === SharboxStatus.CLAIMED) return false;

    // 2. Construct Library Item
    const libraryItem: LibraryItem = {
      ...itemToClaim,
      id: itemToClaim.id_item || crypto.randomUUID(), // Use original ID if available or new
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Clean up Sharbox specific fields
    const { 
      senderName, senderPhotoUrl, senderAffiliation, senderUniqueAppId, 
      senderEmail, senderPhone, senderSocialMedia, receiverName, message, 
      timestamp, status, isRead, id_item, ...cleanLibraryItem 
    } = libraryItem as any;

    // 3. Save to Local Library (Supabase)
    const success = await upsertLibraryItemToSupabase(cleanLibraryItem);

    if (success) {
      // 4. Update Status in Sharbox Inbox (Supabase)
      const updatedSharboxItem = { ...itemToClaim, status: SharboxStatus.CLAIMED };
      await upsertInboxItemToSupabase(updatedSharboxItem);
      
      // Note: We don't need to update GAS Inbox status because we eventually delete/clear buffer.
      // Or if we keep it, it's fine. The source of truth for display is now Supabase.
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const markSharboxItemAsRead = async (id: string): Promise<boolean> => {
  try {
    const inbox = await fetchInboxFromSupabase();
    const item = inbox.find(i => i.id === id);
    if (item) {
       await upsertInboxItemToSupabase({ ...item, isRead: true });
       return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const deleteSharboxItem = async (id: string, type: 'Inbox' | 'Sent'): Promise<boolean> => {
  if (type === 'Inbox') {
    return await deleteInboxItemFromSupabase(id);
  } else {
    return await deleteSentItemFromSupabase(id);
  }
};
