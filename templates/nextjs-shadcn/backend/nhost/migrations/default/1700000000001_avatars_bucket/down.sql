delete from storage.files
where bucket_id = 'avatars';
delete from storage.buckets
where id = 'avatars';
