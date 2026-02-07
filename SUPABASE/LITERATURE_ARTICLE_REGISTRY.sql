-- XEENAPS ARCHIVED ARTICLES REGISTRY
-- Registry untuk menyimpan artikel literatur yang diarsipkan (Bookmarks/Library)
-- Menggantikan Google Sheets sebagai penyimpanan utama untuk modul ini

CREATE TABLE IF NOT EXISTS public.archived_articles (
    "id" TEXT PRIMARY KEY,
    "title" TEXT,
    "citationHarvard" TEXT,
    "doi" TEXT,
    "url" TEXT,
    "info" TEXT, -- Personal remarks/abstract
    "label" TEXT,
    "isFavorite" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Kolom index pencarian gabungan
);

-- Indexing untuk performa filter dan pencarian
CREATE INDEX IF NOT EXISTS idx_archived_articles_search_all ON public.archived_articles ("search_all");
CREATE INDEX IF NOT EXISTS idx_archived_articles_created_at ON public.archived_articles ("createdAt");

-- Enable Row Level Security (RLS)
ALTER TABLE public.archived_articles ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Publik (Read/Write) - Sesuaikan jika ada Auth di masa depan
CREATE POLICY "Public Access Archived Articles" ON public.archived_articles FOR ALL USING (true);

-- Fungsi Trigger untuk update otomatis search_all
-- Menggabungkan Title, Label, Citation, dan Info untuk pencarian global
CREATE OR REPLACE FUNCTION public.update_archived_article_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."title", '') || ' ' || 
        COALESCE(NEW."label", '') || ' ' || 
        COALESCE(NEW."citationHarvard", '') || ' ' ||
        COALESCE(NEW."info", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger eksekusi
DROP TRIGGER IF EXISTS trigger_update_archived_article_search_index ON public.archived_articles;
CREATE TRIGGER trigger_update_archived_article_search_index
    BEFORE INSERT OR UPDATE ON public.archived_articles
    FOR EACH ROW EXECUTE FUNCTION public.update_archived_article_search_index();