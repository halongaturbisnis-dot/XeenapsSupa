-- XEENAPS PROFILES TABLE
-- Registry utama untuk identitas pengguna
CREATE TABLE IF NOT EXISTS public.profiles (
    "id" TEXT PRIMARY KEY, -- ID tetap: 'MAIN_USER'
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

-- XEENAPS EDUCATION HISTORY TABLE
-- Relasi One-to-Many dari profiles
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

-- XEENAPS CAREER HISTORY TABLE
-- Relasi One-to-Many dari profiles
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

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_history ENABLE ROW LEVEL SECURITY;

-- Create Public Access Policies
CREATE POLICY "Public Access Profiles" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Public Access Education" ON public.education_history FOR ALL USING (true);
CREATE POLICY "Public Access Career" ON public.career_history FOR ALL USING (true);