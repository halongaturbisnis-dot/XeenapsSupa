-- XEENAPS LIBRARY ITEMS TABLE SCHEMA (V2 - CASE SENSITIVE FIX)
CREATE TABLE IF NOT EXISTS public.library_items (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "topic" TEXT,
    "subTopic" TEXT,
    "authors" JSONB DEFAULT '[]'::jsonb,
    "publisher" TEXT,
    "year" TEXT,
    "fullDate" TEXT,
    "pubInfo" JSONB DEFAULT '{}'::jsonb,
    "identifiers" JSONB DEFAULT '{}'::jsonb,
    "source" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "url" TEXT,
    "fileId" TEXT,
    "imageView" TEXT,
    "youtubeId" TEXT,
    "tags" JSONB DEFAULT '{"keywords": [], "labels": []}'::jsonb,
    "abstract" TEXT,
    "mainInfo" TEXT,
    "extractedJsonId" TEXT,
    "insightJsonId" TEXT,
    "storageNodeUrl" TEXT,
    "isFavorite" BOOLEAN DEFAULT false,
    "isBookmarked" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "supportingReferences" JSONB DEFAULT '{"references": [], "videoUrl": ""}'::jsonb
);

-- XEENAPS PRESENTATIONS TABLE SCHEMA (V3 - TEXT[] ARRAY FIX)
CREATE TABLE IF NOT EXISTS public.presentations (
    "id" TEXT PRIMARY KEY,
    "collectionIds" TEXT[] DEFAULT '{}'::text[],
    "gSlidesId" TEXT,
    "title" TEXT NOT NULL,
    "presenters" TEXT[] DEFAULT '{}'::text[],
    "templateName" TEXT,
    "themeConfig" JSONB DEFAULT '{}'::jsonb,
    "slidesCount" INTEGER DEFAULT 0,
    "storageNodeUrl" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- XEENAPS PROFILES TABLE (NEW)
CREATE TABLE IF NOT EXISTS public.profiles (
    "id" TEXT PRIMARY KEY, -- Fixed UUID for personal use: 'MAIN_USER'
    "fullName" TEXT,
    "photoUrl" TEXT,
    "photoFileId" TEXT,
    "photoNodeUrl" TEXT,
    "birthDate" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "sintaId" TEXT,
    "scopusId" TEXT,
    "wosId" TEXT,
    "googleScholarId" TEXT,
    "jobTitle" TEXT,
    "affiliation" TEXT,
    "uniqueAppId" TEXT,
    "socialMedia" TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- XEENAPS EDUCATION HISTORY TABLE (NEW)
CREATE TABLE IF NOT EXISTS public.education_history (
    "id" TEXT PRIMARY KEY,
    "profile_id" TEXT REFERENCES public.profiles("id") ON DELETE CASCADE,
    "level" TEXT,
    "institution" TEXT,
    "major" TEXT,
    "degree" TEXT,
    "startYear" TEXT,
    "endYear" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- XEENAPS CAREER HISTORY TABLE (NEW)
CREATE TABLE IF NOT EXISTS public.career_history (
    "id" TEXT PRIMARY KEY,
    "profile_id" TEXT REFERENCES public.profiles("id") ON DELETE CASCADE,
    "company" TEXT,
    "position" TEXT,
    "type" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "location" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_history ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Public Access Library" ON public.library_items FOR ALL USING (true);
CREATE POLICY "Public Access Presentations" ON public.presentations FOR ALL USING (true);
CREATE POLICY "Public Access Profiles" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Public Access Education" ON public.education_history FOR ALL USING (true);
CREATE POLICY "Public Access Career" ON public.career_history FOR ALL USING (true);