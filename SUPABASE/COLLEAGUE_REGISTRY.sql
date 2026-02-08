-- XEENAPS COLLEAGUE REGISTRY SCHEMA
-- Registry untuk menyimpan metadata Kolega/Network
-- Menggantikan Google Sheets sebagai penyimpanan utama

CREATE TABLE IF NOT EXISTS public.colleagues (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "uniqueAppId" TEXT NOT NULL,
    "affiliation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "socialMedia" TEXT,
    "photoUrl" TEXT,
    "photoFileId" TEXT, -- ID File fisik di Drive
    "photoNodeUrl" TEXT, -- URL Worker GAS tempat file disimpan
    "isFavorite" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Kolom index pencarian gabungan
);

-- Indexing untuk performa filter
CREATE INDEX IF NOT EXISTS idx_colleagues_search_all ON public.colleagues ("search_all");
CREATE INDEX IF NOT EXISTS idx_colleagues_created_at ON public.colleagues ("createdAt");

-- Enable Row Level Security (RLS)
ALTER TABLE public.colleagues ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Publik (Read/Write)
CREATE POLICY "Public Access Colleagues" ON public.colleagues FOR ALL USING (true);

-- Fungsi Trigger untuk update otomatis search_all
CREATE OR REPLACE FUNCTION public.update_colleague_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."name", '') || ' ' || 
        COALESCE(NEW."uniqueAppId", '') || ' ' || 
        COALESCE(NEW."affiliation", '') || ' ' ||
        COALESCE(NEW."email", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger eksekusi
DROP TRIGGER IF EXISTS trigger_update_colleague_search_index ON public.colleagues;
CREATE TRIGGER trigger_update_colleague_search_index
    BEFORE INSERT OR UPDATE ON public.colleagues
    FOR EACH ROW EXECUTE FUNCTION public.update_colleague_search_index();