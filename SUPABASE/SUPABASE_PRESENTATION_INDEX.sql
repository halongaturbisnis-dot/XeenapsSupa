-- ADD SEARCH INDEX COLUMN TO PRESENTATIONS
-- Digunakan untuk optimasi pencarian SmartSearchBox
ALTER TABLE public.presentations 
ADD COLUMN IF NOT EXISTS "search_all" TEXT;

-- Create a standard B-Tree index for basic ilike searching
-- Ini sangat stabil dan tidak memerlukan extension khusus
CREATE INDEX IF NOT EXISTS idx_presentations_search_text ON public.presentations (search_all);

-- Opsional: Jika Anda ingin pencarian parsial yang sangat cepat, jalankan baris di bawah (biasanya didukung Supabase)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_presentations_search_trgm ON public.presentations USING gin (search_all gym_trgm_ops);