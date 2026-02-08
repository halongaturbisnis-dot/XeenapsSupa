-- XEENAPS TEACHING LOGS REGISTRY
-- Menggantikan Google Sheets sebagai penyimpanan utama untuk Teaching Module
-- Menggunakan JSONB untuk array objek kompleks (references, attachments, dll)

CREATE TABLE IF NOT EXISTS public.teaching_logs (
    "id" TEXT PRIMARY KEY,
    "label" TEXT NOT NULL,
    "teachingDate" TEXT, -- ISO Date YYYY-MM-DD
    "startTime" TEXT,
    "endTime" TEXT,
    "institution" TEXT,
    "faculty" TEXT,
    "program" TEXT,
    "academicYear" TEXT,
    "semester" TEXT,
    "classGroup" TEXT,
    "meetingNo" INTEGER DEFAULT 1,
    "mode" TEXT,
    "plannedStudents" INTEGER DEFAULT 0,
    "location" TEXT,
    "eventColor" TEXT DEFAULT '#004A74',
    "skReference" TEXT,

    -- Substance
    "courseTitle" TEXT,
    "courseCode" TEXT,
    "learningOutcomes" TEXT,
    "method" TEXT,
    "theoryCredits" NUMERIC DEFAULT 0,
    "practicalCredits" NUMERIC DEFAULT 0,
    "courseType" TEXT,
    "educationLevel" TEXT,
    "topic" TEXT,
    "role" TEXT,

    -- JSONB Arrays
    "referenceLinks" JSONB DEFAULT '[]'::jsonb,
    "presentationId" JSONB DEFAULT '[]'::jsonb,
    "questionBankId" JSONB DEFAULT '[]'::jsonb,
    "attachmentLink" JSONB DEFAULT '[]'::jsonb,
    
    "syllabusLink" TEXT,
    "lectureNotesLink" TEXT,

    -- Reporting
    "actualStartTime" TEXT,
    "actualEndTime" TEXT,
    "teachingDuration" TEXT,
    "totalStudentsPresent" INTEGER DEFAULT 0,
    "attendancePercentage" NUMERIC DEFAULT 0,
    "attendanceListLink" TEXT,
    "problems" TEXT,
    "reflection" TEXT,
    "assignmentType" TEXT,
    "assessmentCriteria" TEXT,

    -- System
    "vaultJsonId" TEXT, -- File fisik di Drive (via GAS)
    "storageNodeUrl" TEXT, -- Worker URL
    "status" TEXT DEFAULT 'Planned',
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Index pencarian
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_teaching_logs_search_all ON public.teaching_logs ("search_all");
CREATE INDEX IF NOT EXISTS idx_teaching_logs_date ON public.teaching_logs ("teachingDate");
CREATE INDEX IF NOT EXISTS idx_teaching_logs_created_at ON public.teaching_logs ("createdAt");

-- RLS
ALTER TABLE public.teaching_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access Teaching Logs" ON public.teaching_logs FOR ALL USING (true);

-- Trigger Search Index
CREATE OR REPLACE FUNCTION public.update_teaching_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."label", '') || ' ' || 
        COALESCE(NEW."courseTitle", '') || ' ' || 
        COALESCE(NEW."courseCode", '') || ' ' ||
        COALESCE(NEW."topic", '') || ' ' ||
        COALESCE(NEW."institution", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_teaching_search_index ON public.teaching_logs;
CREATE TRIGGER trigger_update_teaching_search_index
    BEFORE INSERT OR UPDATE ON public.teaching_logs
    FOR EACH ROW EXECUTE FUNCTION public.update_teaching_search_index();