-- XEENAPS TRACER REGISTRY SCHEMA
-- Menggantikan Google Sheets untuk Audit Trail & Lab Logs

-- 1. TRACER PROJECTS
CREATE TABLE IF NOT EXISTS public.tracer_projects (
    "id" TEXT PRIMARY KEY,
    "title" TEXT,
    "label" TEXT NOT NULL,
    "topic" TEXT,
    "problemStatement" TEXT,
    "researchGap" TEXT,
    "researchQuestion" TEXT,
    "methodology" TEXT,
    "population" TEXT,
    "keywords" TEXT[] DEFAULT '{}'::text[],
    "category" TEXT,
    "authors" TEXT[] DEFAULT '{}'::text[],
    "startDate" TEXT,
    "estEndDate" TEXT,
    "status" TEXT,
    "progress" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Index pencarian
);

-- 2. TRACER LOGS (Journal)
CREATE TABLE IF NOT EXISTS public.tracer_logs (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT REFERENCES public.tracer_projects("id") ON DELETE CASCADE,
    "date" TEXT,
    "title" TEXT,
    "logJsonId" TEXT, -- File fisik JSON di Drive
    "storageNodeUrl" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- 3. TRACER REFERENCES (Library Links)
CREATE TABLE IF NOT EXISTS public.tracer_references (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT REFERENCES public.tracer_projects("id") ON DELETE CASCADE,
    "collectionId" TEXT NOT NULL,
    "contentJsonId" TEXT, -- File fisik JSON untuk quotes
    "storageNodeUrl" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 4. TRACER TODOS (Tasks)
CREATE TABLE IF NOT EXISTS public.tracer_todos (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT REFERENCES public.tracer_projects("id") ON DELETE CASCADE,
    "title" TEXT,
    "description" TEXT,
    "startDate" TEXT,
    "deadline" TEXT,
    "linkLabel" TEXT,
    "linkUrl" TEXT,
    "isDone" BOOLEAN DEFAULT false,
    "completedDate" TEXT,
    "completionRemarks" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- 5. TRACER FINANCE (Ledger)
CREATE TABLE IF NOT EXISTS public.tracer_finance (
    "id" TEXT PRIMARY KEY,
    "projectId" TEXT REFERENCES public.tracer_projects("id") ON DELETE CASCADE,
    "date" TEXT,
    "credit" NUMERIC DEFAULT 0,
    "debit" NUMERIC DEFAULT 0,
    "balance" NUMERIC DEFAULT 0,
    "description" TEXT,
    "attachmentsJsonId" TEXT, -- File fisik JSON untuk bukti
    "storageNodeUrl" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_tracer_projects_search_all ON public.tracer_projects ("search_all");
CREATE INDEX IF NOT EXISTS idx_tracer_logs_project_id ON public.tracer_logs ("projectId");
CREATE INDEX IF NOT EXISTS idx_tracer_refs_project_id ON public.tracer_references ("projectId");
CREATE INDEX IF NOT EXISTS idx_tracer_todos_project_id ON public.tracer_todos ("projectId");
CREATE INDEX IF NOT EXISTS idx_tracer_finance_project_id ON public.tracer_finance ("projectId");
CREATE INDEX IF NOT EXISTS idx_tracer_finance_search_all ON public.tracer_finance ("search_all");

-- RLS
ALTER TABLE public.tracer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracer_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracer_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracer_finance ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public Access Tracer Projects" ON public.tracer_projects FOR ALL USING (true);
CREATE POLICY "Public Access Tracer Logs" ON public.tracer_logs FOR ALL USING (true);
CREATE POLICY "Public Access Tracer References" ON public.tracer_references FOR ALL USING (true);
CREATE POLICY "Public Access Tracer Todos" ON public.tracer_todos FOR ALL USING (true);
CREATE POLICY "Public Access Tracer Finance" ON public.tracer_finance FOR ALL USING (true);

-- Trigger Search Index (Projects)
CREATE OR REPLACE FUNCTION public.update_tracer_project_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."title", '') || ' ' || 
        COALESCE(NEW."label", '') || ' ' || 
        COALESCE(NEW."topic", '') || ' ' ||
        COALESCE(NEW."status", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tracer_project_search_index ON public.tracer_projects;
CREATE TRIGGER trigger_update_tracer_project_search_index
    BEFORE INSERT OR UPDATE ON public.tracer_projects
    FOR EACH ROW EXECUTE FUNCTION public.update_tracer_project_search_index();

-- Trigger Search Index (Finance)
CREATE OR REPLACE FUNCTION public.update_tracer_finance_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."description", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tracer_finance_search_index ON public.tracer_finance;
CREATE TRIGGER trigger_update_tracer_finance_search_index
    BEFORE INSERT OR UPDATE ON public.tracer_finance
    FOR EACH ROW EXECUTE FUNCTION public.update_tracer_finance_search_index();
