-- Insert file metadata
-- We're only inserting the file id for now so the FK from `public.images` does not break.
-- The actual file will be uploaded and populate all other columns later.
INSERT INTO storage.files (id) VALUES ('3d62252d-8db2-4b2b-ba63-f2ef64af4267'), ('039f89ef-f151-418f-b2db-83c94fbf0fa5');

-- Insert public.images metadata
INSERT INTO public.images (id, file_id, name) VALUES ('5ced5c51-98a4-4e16-9b8a-de03267d42fc', '3d62252d-8db2-4b2b-ba63-f2ef64af4267', 'nhost-nextjs.png'), ('05b62110-dfa7-42f6-a298-30a60c8a0324', '039f89ef-f151-418f-b2db-83c94fbf0fa5', 'nhost-apple-sign-in.png');

