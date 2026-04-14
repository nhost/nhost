DROP TRIGGER IF EXISTS update_communities_updated_at ON public.communities;
ALTER TABLE public.communities DROP COLUMN IF EXISTS updated_at;
