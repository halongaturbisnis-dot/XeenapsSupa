-- XEENAPS SHARBOX REGISTRY SCHEMA
-- Registry untuk menyimpan pesan Inbox dan Sent
-- Menggantikan Google Sheets sebagai penyimpanan utama (Inbox Buffer Strategy)

-- 1. SHARBOX INBOX TABLE
CREATE TABLE IF NOT EXISTS public.sharbox_inbox (
    "id" TEXT PRIMARY KEY, -- Transaction ID
    "senderName" TEXT,
    "senderPhotoUrl" TEXT,
    "senderAffiliation" TEXT,
    "senderUniqueAppId" TEXT,
    "senderEmail" TEXT,
    "senderPhone" TEXT,
    "senderSocialMedia" TEXT,
    "receiverName" TEXT, -- Biasanya user saat ini
    "message" TEXT,
    "timestamp" TIMESTAMPTZ DEFAULT now(),
    "status" TEXT DEFAULT 'UNCLAIMED',
    "isRead" BOOLEAN DEFAULT false,
    
    -- Library Item Data (Flattened + JSONB for complex fields)
    "id_item" TEXT, -- Original Library ID
    "title" TEXT,
    "type" TEXT,
    "category" TEXT,
    "topic" TEXT,
    "subTopic" TEXT,
    "authors" JSONB DEFAULT '[]'::jsonb,
    "publisher" TEXT,
    "year" TEXT,
    "fullDate" TEXT,
    "pubInfo" JSONB DEFAULT '{}'::jsonb,
    "identifiers" JSONB DEFAULT '{}'::jsonb,
    "source" TEXT,
    "format" TEXT,
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
    "supportingReferences" JSONB DEFAULT '{"references": [], "videoUrl": ""}'::jsonb,
    
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Index pencarian
);

-- 2. SHARBOX SENT TABLE
CREATE TABLE IF NOT EXISTS public.sharbox_sent (
    "id" TEXT PRIMARY KEY, -- Transaction ID
    "receiverName" TEXT,
    "receiverPhotoUrl" TEXT,
    "receiverUniqueAppId" TEXT,
    "receiverEmail" TEXT,
    "receiverPhone" TEXT,
    "receiverSocialMedia" TEXT,
    "message" TEXT,
    "timestamp" TIMESTAMPTZ DEFAULT now(),
    "status" TEXT DEFAULT 'SENT',
    
    -- Library Item Data (Flattened + JSONB for complex fields)
    "id_item" TEXT, -- Original Library ID
    "title" TEXT,
    "type" TEXT,
    "category" TEXT,
    "topic" TEXT,
    "subTopic" TEXT,
    "authors" JSONB DEFAULT '[]'::jsonb,
    "publisher" TEXT,
    "year" TEXT,
    "fullDate" TEXT,
    "pubInfo" JSONB DEFAULT '{}'::jsonb,
    "identifiers" JSONB DEFAULT '{}'::jsonb,
    "source" TEXT,
    "format" TEXT,
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
    "supportingReferences" JSONB DEFAULT '{"references": [], "videoUrl": ""}'::jsonb,
    
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Index pencarian
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_sharbox_inbox_search_all ON public.sharbox_inbox ("search_all");
CREATE INDEX IF NOT EXISTS idx_sharbox_sent_search_all ON public.sharbox_sent ("search_all");
CREATE INDEX IF NOT EXISTS idx_sharbox_inbox_timestamp ON public.sharbox_inbox ("timestamp");
CREATE INDEX IF NOT EXISTS idx_sharbox_sent_timestamp ON public.sharbox_sent ("timestamp");

-- RLS
ALTER TABLE public.sharbox_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sharbox_sent ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public Access Sharbox Inbox" ON public.sharbox_inbox FOR ALL USING (true);
CREATE POLICY "Public Access Sharbox Sent" ON public.sharbox_sent FOR ALL USING (true);

-- --- FIX: SEPARATED TRIGGERS FOR INBOX AND SENT ---

-- 1. Function for INBOX (Includes senderName)
CREATE OR REPLACE FUNCTION public.update_sharbox_inbox_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."title", '') || ' ' || 
        COALESCE(NEW."message", '') || ' ' ||
        COALESCE(NEW."senderName", '') -- Valid in Inbox
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Function for SENT (Includes receiverName, NO senderName)
CREATE OR REPLACE FUNCTION public.update_sharbox_sent_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."title", '') || ' ' || 
        COALESCE(NEW."message", '') || ' ' ||
        COALESCE(NEW."receiverName", '') -- Valid in Sent
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old triggers if they exist to prevent conflicts
DROP TRIGGER IF EXISTS trigger_update_inbox_search ON public.sharbox_inbox;
DROP TRIGGER IF EXISTS trigger_update_sent_search ON public.sharbox_sent;
DROP FUNCTION IF EXISTS public.update_sharbox_search_index; -- Remove the old buggy generic function

-- Re-create Triggers pointing to correct functions
CREATE TRIGGER trigger_update_inbox_search
    BEFORE INSERT OR UPDATE ON public.sharbox_inbox
    FOR EACH ROW EXECUTE FUNCTION public.update_sharbox_inbox_search_index();

CREATE TRIGGER trigger_update_sent_search
    BEFORE INSERT OR UPDATE ON public.sharbox_sent
    FOR EACH ROW EXECUTE FUNCTION public.update_sharbox_sent_search_index();
