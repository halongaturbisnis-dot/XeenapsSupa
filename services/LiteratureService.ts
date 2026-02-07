import { LiteratureArticle, ArchivedArticleItem, ArchivedBookItem, GASResponse } from '../types';
import { GAS_WEB_APP_URL } from '../constants';
import { 
  fetchArchivedArticlesPaginatedFromSupabase, 
  upsertArchivedArticleToSupabase, 
  deleteArchivedArticleFromSupabase 
} from './LiteratureSupabaseService';

/**
 * XEENAPS LITERATURE SEARCH SERVICE
 * Hybrid Integration:
 * - Articles Registry -> Supabase (Primary Source of Truth)
 * - Books Registry -> Google Sheets (Legacy / GAS)
 * - External Search (OpenAlex/OpenLibrary) -> GAS Proxy
 */

// Client-side Session Cache (Non-persistent on F5, but survives route navigation)
let searchCache = {
  query: '',
  yearStart: '',
  yearEnd: '',
  results: [] as LiteratureArticle[]
};

let bookSearchCache = {
  query: '',
  yearStart: '',
  yearEnd: '',
  results: [] as LiteratureArticle[]
};

export const getSearchCache = () => searchCache;
export const setSearchCache = (data: typeof searchCache) => {
  searchCache = data;
};

export const getBookSearchCache = () => bookSearchCache;
export const setBookSearchCache = (data: typeof bookSearchCache) => {
  bookSearchCache = data;
};

export const searchArticles = async (
  query: string, 
  yearStart?: number, 
  yearEnd?: number,
  limit: number = 12
): Promise<LiteratureArticle[]> => {
  if (!GAS_WEB_APP_URL) return [];
  try {
    const url = `${GAS_WEB_APP_URL}?action=searchGlobalArticles&query=${encodeURIComponent(query)}&yearStart=${yearStart || ''}&yearEnd=${yearEnd || ''}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Proxy Search failed');
    const result = await response.json();
    if (result.status === 'success') {
      return result.data || [];
    } else {
      console.warn("Search Proxy Warning:", result.message);
      return [];
    }
  } catch (error) {
    console.error("Search articles exception:", error);
    return [];
  }
};

export const searchBooks = async (
  query: string, 
  yearStart?: number, 
  yearEnd?: number,
  limit: number = 12
): Promise<LiteratureArticle[]> => {
  if (!GAS_WEB_APP_URL) return [];
  try {
    const url = `${GAS_WEB_APP_URL}?action=searchGlobalBooks&query=${encodeURIComponent(query)}&yearStart=${yearStart || ''}&yearEnd=${yearEnd || ''}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Proxy Search failed');
    const result = await response.json();
    if (result.status === 'success') {
      return result.data || [];
    } else {
      console.warn("Book Search Proxy Warning:", result.message);
      return [];
    }
  } catch (error) {
    console.error("Search books exception:", error);
    return [];
  }
};

// --- ARCHIVED ARTICLES (MIGRATED TO SUPABASE) ---

export const fetchArchivedArticlesPaginated = async (
  page: number = 1,
  limit: number = 25,
  search: string = "",
  sortKey: string = "createdAt",
  sortDir: string = "desc",
  signal?: AbortSignal
): Promise<{ items: ArchivedArticleItem[], totalCount: number }> => {
  // Direct call to Supabase Registry
  return await fetchArchivedArticlesPaginatedFromSupabase(page, limit, search, sortKey, sortDir);
};

export const archiveArticle = async (article: LiteratureArticle, label: string): Promise<boolean> => {
  try {
    const authorList = article.authors?.map(a => a.name).join(', ') || 'Anonymous';
    const citation = `${authorList} (${article.year || 'n.d.'}). '${article.title}'. ${article.venue || 'Global Database'}.`;

    const archivedItem: ArchivedArticleItem = {
      id: crypto.randomUUID(),
      title: article.title,
      citationHarvard: citation,
      doi: article.doi || '',
      url: article.url || '',
      info: article.abstract || '',
      label: label.toUpperCase(),
      isFavorite: false,
      createdAt: new Date().toISOString()
    };

    // Save to Supabase
    return await upsertArchivedArticleToSupabase(archivedItem);
  } catch (error) {
    return false;
  }
};

export const deleteArchivedArticle = async (id: string): Promise<boolean> => {
  // Delete from Supabase
  return await deleteArchivedArticleFromSupabase(id);
};

export const toggleFavoriteArticle = async (id: string, status: boolean): Promise<boolean> => {
  // Update in Supabase
  return await upsertArchivedArticleToSupabase({ id, isFavorite: status });
};

// --- ARCHIVED BOOKS (LEGACY / GAS) ---

export const fetchArchivedBooksPaginated = async (
  page: number = 1,
  limit: number = 25,
  search: string = "",
  sortKey: string = "createdAt",
  sortDir: string = "desc",
  signal?: AbortSignal
): Promise<{ items: ArchivedBookItem[], totalCount: number }> => {
  if (!GAS_WEB_APP_URL) return { items: [], totalCount: 0 };
  try {
    const url = `${GAS_WEB_APP_URL}?action=getArchivedBooks&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sortKey=${sortKey}&sortDir=${sortDir}`;
    const response = await fetch(url, { signal });
    const result = await response.json();
    if (result.status === 'success') {
      return {
        items: result.data || [],
        totalCount: result.totalCount || 0
      };
    }
    return { items: [], totalCount: 0 };
  } catch (error) {
    return { items: [], totalCount: 0 };
  }
};

export const archiveBook = async (book: LiteratureArticle, label: string): Promise<boolean> => {
  if (!GAS_WEB_APP_URL) return false;
  try {
    const authorList = book.authors?.map(a => a.name).join(', ') || 'Anonymous';
    const citation = `${authorList} (${book.year || 'n.d.'}). '${book.title}'. ${book.venue || 'Global Publisher'}.`;

    const archivedItem: Partial<ArchivedBookItem> = {
      id: crypto.randomUUID(),
      title: book.title,
      citationHarvard: citation,
      isbn: book.isbn || '',
      url: book.url || '',
      info: book.abstract || '',
      label: label.toUpperCase(),
      isFavorite: false,
      createdAt: new Date().toISOString()
    };

    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveArchivedBook', item: archivedItem })
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    return false;
  }
};

export const deleteArchivedBook = async (id: string): Promise<boolean> => {
  if (!GAS_WEB_APP_URL) return false;
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteArchivedBook', id })
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    return false;
  }
};

export const toggleFavoriteBook = async (id: string, status: boolean): Promise<boolean> => {
  if (!GAS_WEB_APP_URL) return false;
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'toggleFavoriteBook', id, status })
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    return false;
  }
};