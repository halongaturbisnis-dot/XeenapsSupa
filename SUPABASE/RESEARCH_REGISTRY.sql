-- XEENAPS RESEARCH REGISTRY SCHEMA
-- Menggantikan Google Sheets untuk Research Projects & Gap Analysis Matrix

-- 1. RESEARCH PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.research_projects (
    "id" TEXT PRIMARY KEY,
    "projectName" TEXT NOT NULL,
    "language" TEXT DEFAULT 'English',
    "status" TEXT DEFAULT 'Draft', -- Draft, Finalized, Utilized
    "isFavorite" BOOLEAN DEFAULT false,
    "isUsed" BOOLEAN DEFAULT false,
    "proposedTitle" TEXT,
    "noveltyNarrative" TEXT,
    "futureDirections" TEXT, -- Disimpan sebagai JSON string
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Index pencarian
);

-- 2. RESEARCH SOURCES (GAP MATRIX) TABLE
CREATE TABLE IF NOT EXISTS public.research_sources (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT REFERENCES public.research_projects("id") ON DELETE CASCADE,
    "sourceId" TEXT NOT NULL, -- Link ke Library ID
    "title" TEXT,
    "findings" TEXT,
    "methodology" TEXT,
    "limitations" TEXT,
    "isFavorite" BOOLEAN DEFAULT false,
    "isUsed" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Index pencarian
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_research_projects_search_all ON public.research_projects ("search_all");
CREATE INDEX IF NOT EXISTS idx_research_sources_project_id ON public.research_sources ("projectId");
CREATE INDEX IF NOT EXISTS idx_research_sources_source_id ON public.research_sources ("sourceId");

-- RLS
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public Access Research Projects" ON public.research_projects FOR ALL USING (true);
CREATE POLICY "Public Access Research Sources" ON public.research_sources FOR ALL USING (true);

-- Triggers untuk search_all (Projects)
CREATE OR REPLACE FUNCTION public.update_research_project_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."projectName", '') || ' ' || 
        COALESCE(NEW."proposedTitle", '') || ' ' ||
        COALESCE(NEW."status", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_research_project_search_index ON public.research_projects;
CREATE TRIGGER trigger_update_research_project_search_index
    BEFORE INSERT OR UPDATE ON public.research_projects
    FOR EACH ROW EXECUTE FUNCTION public.update_research_project_search_index();

-- Triggers untuk search_all (Sources)
CREATE OR REPLACE FUNCTION public.update_research_source_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."title", '') || ' ' || 
        COALESCE(NEW."findings", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_research_source_search_index ON public.research_sources;
CREATE TRIGGER trigger_update_research_source_search_index
    BEFORE INSERT OR UPDATE ON public.research_sources
    FOR EACH ROW EXECUTE FUNCTION public.update_research_source_search_index();
