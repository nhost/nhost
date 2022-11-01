-- insert file metadata
INSERT INTO storage.files (id, name, size, mime_type, etag, is_uploaded) VALUES ('3d62252d-8db2-4b2b-ba63-f2ef64af4267', 'nhost-nextjs.png', 12131, 'image/png', '"52fb92ddfaa492f469a5018593119b40"', true);

-- insert public.images metadata
INSERT INTO public.images (id, file_id, name) VALUES ('5ced5c51-98a4-4e16-9b8a-de03267d42fc', '3d62252d-8db2-4b2b-ba63-f2ef64af4267', 'nhost-nextjs.png');

