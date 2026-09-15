DROP TRIGGER IF EXISTS set_notes_updated_at ON public.notes;

DROP TABLE IF EXISTS public.note_tags;
DROP TABLE IF EXISTS public.tags;
DROP TABLE IF EXISTS public.notes;
DROP TABLE IF EXISTS public.notebooks;

DROP FUNCTION IF EXISTS public.set_updated_at();
