-- XEENAPS BRAINSTORMING REGISTRY SCHEMA
-- Menggantikan Google Sheets untuk Research Incubation & Brainstorming
-- Menggunakan TEXT[] untuk array native (keywords, pillars, refs)

CREATE TABLE IF NOT EXISTS public.brainstorming (
    "id" TEXT PRIMARY KEY,
    "label" TEXT NOT NULL,
    "roughIdea" TEXT,
    "proposedTitle" TEXT,
    "problemStatement" TEXT,
    "researchGap" TEXT,
    "researchQuestion" TEXT,
    "methodology" TEXT,
    "population" TEXT,
    "keywords" TEXT[] DEFAULT '{}'::text[],
    "pillars" TEXT[] DEFAULT '{}'::text[],
    "proposedAbstract" TEXT,
    "externalRefs" TEXT[] DEFAULT '{}'::text[], -- OpenAlex results
    "internalRefs" TEXT[] DEFAULT '{}'::text[], -- Library IDs
    "isFavorite" BOOLEAN DEFAULT false,
    "isUsed" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Index pencarian gabungan
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_brainstorming_search_all ON public.brainstorming ("search_all");
CREATE INDEX IF NOT EXISTS idx_brainstorming_created_at ON public.brainstorming ("createdAt");

-- RLS
ALTER TABLE public.brainstorming ENABLE ROW LEVEL SECURITY;

-- Policy (Public Access as per standard)
CREATE POLICY "Public Access Brainstorming" ON public.brainstorming FOR ALL USING (true);

-- Trigger untuk search_all
CREATE OR REPLACE FUNCTION public.update_brainstorming_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."label", '') || ' ' || 
        COALESCE(NEW."roughIdea", '') || ' ' ||
        COALESCE(NEW."proposedTitle", '') || ' ' ||
        COALESCE(NEW."researchQuestion", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_brainstorming_search_index ON public.brainstorming;
CREATE TRIGGER trigger_update_brainstorming_search_index
    BEFORE INSERT OR UPDATE ON public.brainstorming
    FOR EACH ROW EXECUTE FUNCTION public.update_brainstorming_search_index();