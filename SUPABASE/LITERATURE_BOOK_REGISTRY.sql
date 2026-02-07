-- XEENAPS ARCHIVED BOOKS REGISTRY
-- Registry untuk menyimpan buku literatur yang diarsipkan
-- Menggantikan Google Sheets sebagai penyimpanan utama untuk modul ini

CREATE TABLE IF NOT EXISTS public.archived_books (
    "id" TEXT PRIMARY KEY,
    "title" TEXT,
    "citationHarvard" TEXT,
    "isbn" TEXT,
    "url" TEXT,
    "info" TEXT, -- Personal remarks/abstract
    "label" TEXT,
    "isFavorite" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Kolom index pencarian gabungan
);

-- Indexing untuk performa filter dan pencarian
CREATE INDEX IF NOT EXISTS idx_archived_books_search_all ON public.archived_books ("search_all");
CREATE INDEX IF NOT EXISTS idx_archived_books_created_at ON public.archived_books ("createdAt");

-- Enable Row Level Security (RLS)
ALTER TABLE public.archived_books ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Publik (Read/Write)
CREATE POLICY "Public Access Archived Books" ON public.archived_books FOR ALL USING (true);

-- Fungsi Trigger untuk update otomatis search_all
-- Menggabungkan Title, Label, Citation, dan Info untuk pencarian global
CREATE OR REPLACE FUNCTION public.update_archived_book_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."title", '') || ' ' || 
        COALESCE(NEW."label", '') || ' ' || 
        COALESCE(NEW."citationHarvard", '') || ' ' ||
        COALESCE(NEW."info", '') || ' ' ||
        COALESCE(NEW."isbn", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger eksekusi
DROP TRIGGER IF EXISTS trigger_update_archived_book_search_index ON public.archived_books;
CREATE TRIGGER trigger_update_archived_book_search_index
    BEFORE INSERT OR UPDATE ON public.archived_books
    FOR EACH ROW EXECUTE FUNCTION public.update_archived_book_search_index();