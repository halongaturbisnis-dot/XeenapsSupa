-- XEENAPS QUESTION BANK TABLE SCHEMA
-- Registry utama untuk bank soal akademik
CREATE TABLE IF NOT EXISTS public.questions (
    "id" TEXT PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "bloomLevel" TEXT NOT NULL,
    "customLabel" TEXT,
    "questionText" TEXT NOT NULL,
    "options" JSONB DEFAULT '[]'::jsonb,
    "correctAnswer" TEXT NOT NULL,
    "reasoningCorrect" TEXT,
    "reasoningDistractors" JSONB DEFAULT '{}'::jsonb,
    "verbatimReference" TEXT,
    "language" TEXT DEFAULT 'English',
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Column for unified search indexing
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_questions_collection_id ON public.questions ("collectionId");
CREATE INDEX IF NOT EXISTS idx_questions_bloom_level ON public.questions ("bloomLevel");
CREATE INDEX IF NOT EXISTS idx_questions_search_all ON public.questions ("search_all");

-- Enable Row Level Security
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Create Public Access Policy
CREATE POLICY "Public Access Questions" ON public.questions FOR ALL USING (true);

-- Function to automatically update search_all index
-- FIXED: Added double quotes to column names for case-sensitivity support
CREATE OR REPLACE FUNCTION public.update_question_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."questionText", '') || ' ' || 
        COALESCE(NEW."customLabel", '') || ' ' || 
        COALESCE(NEW."bloomLevel", '') || ' ' ||
        COALESCE(NEW."verbatimReference", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search index
DROP TRIGGER IF EXISTS trigger_update_question_search_index ON public.questions;
CREATE TRIGGER trigger_update_question_search_index
    BEFORE INSERT OR UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.update_question_search_index();