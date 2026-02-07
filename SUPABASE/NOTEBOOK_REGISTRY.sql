-- XEENAPS NOTEBOOK REGISTRY SCHEMA
-- Tabel untuk menyimpan metadata catatan (Notes)
-- Menggantikan Google Sheets sebagai registry utama

CREATE TABLE IF NOT EXISTS public.notes (
    "id" TEXT PRIMARY KEY,
    "collectionId" TEXT,
    "collectionTitle" TEXT,
    "label" TEXT NOT NULL,
    "searchIndex" TEXT, -- Teks gabungan dari konten untuk pencarian
    "noteJsonId" TEXT,  -- ID File fisik di Google Drive
    "storageNodeUrl" TEXT, -- URL Worker GAS yang menyimpan file
    "isFavorite" BOOLEAN DEFAULT false,
    "isUsed" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "search_all" TEXT -- Kolom index pencarian gabungan performa tinggi
);

-- Indexing untuk performa filter
CREATE INDEX IF NOT EXISTS idx_notes_collection_id ON public.notes ("collectionId");
CREATE INDEX IF NOT EXISTS idx_notes_search_all ON public.notes ("search_all");

-- Enable Row Level Security (RLS)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Publik (Read/Write)
CREATE POLICY "Public Access Notes" ON public.notes FOR ALL USING (true);

-- Fungsi Trigger untuk update otomatis search_all
-- Menggabungkan Label, Judul Koleksi, dan SearchIndex (konten ringkas)
CREATE OR REPLACE FUNCTION public.update_note_search_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_all" := LOWER(
        COALESCE(NEW."label", '') || ' ' || 
        COALESCE(NEW."collectionTitle", '') || ' ' || 
        COALESCE(NEW."searchIndex", '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger eksekusi
DROP TRIGGER IF EXISTS trigger_update_note_search_index ON public.notes;
CREATE TRIGGER trigger_update_note_search_index
    BEFORE INSERT OR UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.update_note_search_index();
