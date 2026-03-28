DROP TABLE IF EXISTS public.community_files;
DROP TABLE IF EXISTS public.community_members;
DROP TABLE IF EXISTS public.communities;
DELETE FROM storage.buckets WHERE id IN ('personal', 'communities');
