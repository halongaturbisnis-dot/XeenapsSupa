-- XEENAPS ACTIVITY REGISTRY SCHEMA
-- Registry untuk menyimpan metadata Kegiatan/Aktivitas (Portfolio)
-- Menggantikan Google Sheets sebagai penyimpanan utama metadata

CREATE TABLE IF NOT EXISTS public.activities (
    "id" TEXT PRIMARY KEY,
    "type" TEXT NOT NULL, -- Seminar, Workshop, etc.
    "eventName" TEXT NOT NULL,
    "organizer" TEXT,
    "location" TEXT,
    "level" TEXT, -- International, National, etc.
    "startDate" TEXT, -- ISO String YYYY-MM-DD
    "endDate" TEXT, -- ISO String YYYY-MM-DD
    "role" TEXT, -- Participant, Speaker, etc.
    "description" TEXT,
    "notes" TEXT,
    "certificateNumber" TEXT,
    "credit" TEXT,
    "link" TEXT,
    "isFavorite" BOOLEAN DEFAULT false,
    "vaultJsonId" TEXT, -- Sharding ID untuk dokumentasi
    "storageNodeUrl" TEXT, -- URL Worker GAS untuk vault
    "certificateFileId" TEXT, -- ID File sertifikat fisik di Drive
    "certificateNodeUrl" TEXT, -- URL Worker GAS untuk sertifikat
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Kolom index pencarian gabungan
);

-- Indexing untuk performa filter
CREATE INDEX IF NOT EXISTS idx_activities_search_all ON public.activities ("search_all");
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.activities ("type");
CREATE INDEX IF NOT EXISTS idx_activities_start_date ON public.activities ("startDate");
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities ("createdAt");

-- Enable Row Level Security (RLS)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Publik (Read/Write)
CREATE POLICY "Public Access Activities" ON public.activities FOR ALL USING (true);

-- Fungsi Trigger untuk update otomatis search_all
CREATE OR REPLACE FUNCTION public.update_activity_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."eventName", '') || ' ' || 
        COALESCE(NEW."organizer", '') || ' ' || 
        COALESCE(NEW."description", '') || ' ' ||
        COALESCE(NEW."certificateNumber", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger eksekusi
DROP TRIGGER IF EXISTS trigger_update_activity_search_index ON public.activities;
CREATE TRIGGER trigger_update_activity_search_index
    BEFORE INSERT OR UPDATE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.update_activity_search_index();