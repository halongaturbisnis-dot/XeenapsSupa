import { getSupabase } from './supabaseClient';
import { SharboxItem } from '../types';

/**
 * XEENAPS SHARBOX SUPABASE SERVICE
 * Registry Metadata untuk modul Sharbox (Inbox & Sent).
 */

// Helper to clean object for Transport Tables (Inbox/Sent)
// Removes Library-specific local states that don't exist in Sharbox schema
const sanitizeSharboxPayload = (item: SharboxItem, target: 'INBOX' | 'SENT') => {
  const { 
    search_all, 
    isFavorite, 
    isBookmarked, 
    ...cleanItem 
  } = item as any;

  // FIX 400 ERROR: 'isRead' column only exists in Inbox, not Sent.
  // We must remove it when saving to Sent box.
  if (target === 'SENT') {
    delete cleanItem.isRead;
  }

  return cleanItem;
};

// --- INBOX OPERATIONS ---

export const fetchInboxFromSupabase = async (): Promise<SharboxItem[]> => {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('sharbox_inbox')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error("Supabase Inbox Fetch Error:", error);
    return [];
  }
  return data || [];
};

export const upsertInboxItemToSupabase = async (item: SharboxItem): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  const payload = sanitizeSharboxPayload(item, 'INBOX');
  const { error } = await client.from('sharbox_inbox').upsert(payload);

  if (error) {
    console.error("Supabase Inbox Upsert Error:", error);
    return false;
  }
  return true;
};

export const deleteInboxItemFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;
  const { error } = await client.from('sharbox_inbox').delete().eq('id', id);
  return !error;
};

// --- SENT OPERATIONS ---

export const fetchSentFromSupabase = async (): Promise<SharboxItem[]> => {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('sharbox_sent')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error("Supabase Sent Fetch Error:", error);
    return [];
  }
  return data || [];
};

export const upsertSentItemToSupabase = async (item: SharboxItem): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  const payload = sanitizeSharboxPayload(item, 'SENT');
  const { error } = await client.from('sharbox_sent').upsert(payload);

  if (error) {
    console.error("Supabase Sent Upsert Error:", error);
    return false;
  }
  return true;
};

export const deleteSentItemFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;
  const { error } = await client.from('sharbox_sent').delete().eq('id', id);
  return !error;
};
