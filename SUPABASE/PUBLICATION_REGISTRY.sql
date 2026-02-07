
-- XEENAPS PUBLICATION REGISTRY SCHEMA
-- Menggantikan Google Sheets sebagai penyimpanan utama untuk Publication Module
-- Menggunakan Native Arrays (TEXT[]) untuk authors dan keywords agar kompatibel dengan filter Supabase

CREATE TABLE IF NOT EXISTS public.publications (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "authors" TEXT[] DEFAULT '{}'::text[],
    "type" TEXT DEFAULT 'Journal', -- Journal, Conference, Book, etc.
    "status" TEXT DEFAULT 'Draft', -- Draft, Submitted, Accepted, etc.
    "publisherName" TEXT,
    "researchDomain" TEXT,
    "affiliation" TEXT,
    "indexing" TEXT,
    "quartile" TEXT,
    "doi" TEXT,
    "issn_isbn" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "pages" TEXT,
    "year" TEXT,
    "submissionDate" TEXT, -- Disimpan sebagai ISO String / YYYY-MM-DD
    "acceptanceDate" TEXT,
    "publicationDate" TEXT,
    "brainstormingId" TEXT, -- Relasi opsional ke Brainstorming
    "libraryId" TEXT,       -- Relasi opsional ke Library
    "manuscriptLink" TEXT,
    "abstract" TEXT,
    "keywords" TEXT[] DEFAULT '{}'::text[],
    "remarks" TEXT,
    "isFavorite" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Kolom index pencarian gabungan
);

-- Indexing untuk performa filter dan pencarian
CREATE INDEX IF NOT EXISTS idx_publications_search_all ON public.publications ("search_all");
CREATE INDEX IF NOT EXISTS idx_publications_status ON public.publications ("status");
CREATE INDEX IF NOT EXISTS idx_publications_created_at ON public.publications ("createdAt");

-- Enable Row Level Security (RLS)
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Publik (Read/Write)
CREATE POLICY "Public Access Publications" ON public.publications FOR ALL USING (true);

-- Fungsi Trigger untuk update otomatis search_all
-- Menggabungkan Title, Publisher, Status, dan Abstract untuk pencarian global
CREATE OR REPLACE FUNCTION public.update_publication_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."title", '') || ' ' || 
        COALESCE(NEW."publisherName", '') || ' ' || 
        COALESCE(NEW."status", '') || ' ' ||
        COALESCE(NEW."indexing", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger eksekusi
DROP TRIGGER IF EXISTS trigger_update_publication_search_index ON public.publications;
CREATE TRIGGER trigger_update_publication_search_index
    BEFORE INSERT OR UPDATE ON public.publications
    FOR EACH ROW EXECUTE FUNCTION public.update_publication_search_index();
