import { getSupabase } from './supabaseClient';
import { SharboxItem } from '../types';

/**
 * XEENAPS SHARBOX SUPABASE SERVICE
 * Registry Metadata untuk modul Sharbox (Inbox & Sent).
 */

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

  const { search_all, ...cleanItem } = item as any;
  const { error } = await client.from('sharbox_inbox').upsert(cleanItem);

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

  const { search_all, ...cleanItem } = item as any;
  const { error } = await client.from('sharbox_sent').upsert(cleanItem);

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
