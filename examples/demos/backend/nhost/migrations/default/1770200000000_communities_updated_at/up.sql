ALTER TABLE public.communities
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
