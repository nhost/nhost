-- The avatar function resizes images before storing them, so the cap only has
-- to fit the processed file, not the original photo.
insert into storage.buckets (id, min_upload_file_size, max_upload_file_size, cache_control)
values ('avatars', 1, 1048576, 'max-age=3600')
on conflict (id) do nothing;
