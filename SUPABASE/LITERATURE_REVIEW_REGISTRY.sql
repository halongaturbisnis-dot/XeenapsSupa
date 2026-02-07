-- XEENAPS LITERATURE REVIEW REGISTRY
-- Registry untuk menyimpan metadata Literature Review (Hybrid Architecture)
-- Menggantikan Google Sheets sebagai penyimpanan utama metadata

CREATE TABLE IF NOT EXISTS public.reviews (
    "id" TEXT PRIMARY KEY,
    "label" TEXT NOT NULL,
    "centralQuestion" TEXT,
    "reviewJsonId" TEXT,  -- ID File fisik di Google Drive (Matrix & Synthesis)
    "storageNodeUrl" TEXT, -- URL Worker GAS yang menyimpan file
    "isFavorite" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Kolom index pencarian gabungan performa tinggi
);

-- Indexing untuk performa filter
CREATE INDEX IF NOT EXISTS idx_reviews_search_all ON public.reviews ("search_all");
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews ("createdAt");

-- Enable Row Level Security (RLS)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Publik (Read/Write)
CREATE POLICY "Public Access Reviews" ON public.reviews FOR ALL USING (true);

-- Fungsi Trigger untuk update otomatis search_all
-- Menggabungkan Label dan Central Question untuk pencarian
CREATE OR REPLACE FUNCTION public.update_review_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."label", '') || ' ' || 
        COALESCE(NEW."centralQuestion", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger eksekusi
DROP TRIGGER IF EXISTS trigger_update_review_search_index ON public.reviews;
CREATE TRIGGER trigger_update_review_search_index
    BEFORE INSERT OR UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_review_search_index();