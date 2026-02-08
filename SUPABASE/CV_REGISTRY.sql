
-- XEENAPS CV ARCHITECT REGISTRY
-- Registry untuk menyimpan metadata dokumen CV yang digenerate
-- Menggantikan Google Sheets sebagai penyimpanan utama

CREATE TABLE IF NOT EXISTS public.cv_documents (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "template" TEXT,
    "fileId" TEXT, -- ID File fisik PDF di Google Drive
    "storageNodeUrl" TEXT, -- URL Worker GAS tempat file disimpan
    "includePhoto" BOOLEAN DEFAULT true,
    "aiSummary" TEXT,
    
    -- Array Data (Protokol #6: Gunakan Native TEXT[])
    "selectedEducationIds" TEXT[] DEFAULT '{}'::text[],
    "selectedCareerIds" TEXT[] DEFAULT '{}'::text[],
    "selectedPublicationIds" TEXT[] DEFAULT '{}'::text[],
    "selectedActivityIds" TEXT[] DEFAULT '{}'::text[],

    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Kolom index pencarian gabungan
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_cv_documents_search_all ON public.cv_documents ("search_all");
CREATE INDEX IF NOT EXISTS idx_cv_documents_created_at ON public.cv_documents ("createdAt");

-- RLS
ALTER TABLE public.cv_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access CV Documents" ON public.cv_documents FOR ALL USING (true);

-- Trigger Search Index
CREATE OR REPLACE FUNCTION public.update_cv_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."title", '') || ' ' || 
        COALESCE(NEW."template", '') || ' ' ||
        COALESCE(NEW."aiSummary", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cv_search_index ON public.cv_documents;
CREATE TRIGGER trigger_update_cv_search_index
    BEFORE INSERT OR UPDATE ON public.cv_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_cv_search_index();
