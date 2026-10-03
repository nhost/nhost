DROP TABLE IF EXISTS public.note_attachments;

DELETE FROM storage.buckets WHERE id = 'notes';
