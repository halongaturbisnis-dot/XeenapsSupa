-- XEENAPS CONSULTATION REGISTRY SCHEMA
-- Tabel untuk menyimpan metadata konsultasi AI (DeepSeek-R1 / Groq)

CREATE TABLE IF NOT EXISTS public.consultations (
    "id" TEXT PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answerJsonId" TEXT,
    "nodeUrl" TEXT,
    "isFavorite" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Kolom index pencarian gabungan
);

-- Indexing untuk performa filter dan pencarian
CREATE INDEX IF NOT EXISTS idx_consultations_collection_id ON public.consultations ("collectionId");
CREATE INDEX IF NOT EXISTS idx_consultations_search_all ON public.consultations ("search_all");

-- Enable Row Level Security (RLS)
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Publik (Bisa disesuaikan nanti untuk auth user)
CREATE POLICY "Public Access Consultations" ON public.consultations FOR ALL USING (true);

-- Fungsi Trigger untuk update otomatis search_all
CREATE OR REPLACE FUNCTION public.update_consultation_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."question", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger eksekusi
DROP TRIGGER IF EXISTS trigger_update_consultation_search_index ON public.consultations;
CREATE TRIGGER trigger_update_consultation_search_index
    BEFORE INSERT OR UPDATE ON public.consultations
    FOR EACH ROW EXECUTE FUNCTION public.update_consultation_search_index();
