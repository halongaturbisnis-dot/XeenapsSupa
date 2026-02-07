import { getSupabase } from './supabaseClient';
import { ActivityItem } from '../types';

/**
 * XEENAPS ACTIVITY SUPABASE SERVICE
 * Registry Metadata untuk modul Activities/Portfolio.
 */

export const fetchActivitiesPaginatedFromSupabase = async (
  page: number = 1,
  limit: number = 25,
  search: string = "",
  startDate: string = "",
  endDate: string = "",
  type: string = "All",
  sortKey: string = "startDate", // Default sort by Event Date usually
  sortDir: string = "desc"
): Promise<{ items: ActivityItem[], totalCount: number }> => {
  const client = getSupabase();
  if (!client) return { items: [], totalCount: 0 };

  let query = client
    .from('activities')
    .select('*', { count: 'exact' });

  // 1. Filter by Type
  if (type !== "All") {
    query = query.eq('type', type);
  }

  // 2. Smart Search (Server-side via search_all)
  if (search) {
    query = query.ilike('search_all', `%${search.toLowerCase()}%`);
  }

  // 3. Date Range Filter (Based on startDate column)
  if (startDate) {
    query = query.gte('startDate', startDate);
  }
  if (endDate) {
    query = query.lte('startDate', endDate); // Logic: Activities starting before or on end date
  }

  // 4. Sorting
  // Special handling: Favorite usually pinned to top, handled by sortKey priority or client side.
  // Standard sort:
  if (sortKey === 'isFavorite') {
      query = query.order('isFavorite', { ascending: false });
      // Secondary sort
      query = query.order('startDate', { ascending: false });
  } else {
      query = query.order(sortKey, { ascending: sortDir === 'asc' });
  }

  // 5. Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("Supabase Activities Fetch Error:", error);
    return { items: [], totalCount: 0 };
  }

  return {
    items: data || [],
    totalCount: count || 0
  };
};

export const upsertActivityToSupabase = async (item: ActivityItem): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  // Sanitasi: Hapus search_all agar di-handle oleh trigger DB
  const { search_all, ...cleanItem } = item as any;

  const { error } = await client
    .from('activities')
    .upsert(cleanItem);

  if (error) {
    console.error("Supabase Activity Upsert Error:", error);
    return false;
  }
  return true;
};

export const deleteActivityFromSupabase = async (id: string): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  const { error } = await client
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Supabase Activity Delete Error:", error);
    return false;
  }
  return true;
};

// Helper to get single item for file cleanup
export const fetchActivityByIdFromSupabase = async (id: string): Promise<ActivityItem | null> => {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from('activities')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
};