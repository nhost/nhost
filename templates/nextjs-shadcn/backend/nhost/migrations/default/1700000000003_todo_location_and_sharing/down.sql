alter table public.todos
drop column file_id,
drop column sort_order,
drop column is_public,
drop column preposition,
drop column location;

delete from storage.files
where bucket_id = 'todo-attachments';
delete from storage.buckets
where id = 'todo-attachments';
