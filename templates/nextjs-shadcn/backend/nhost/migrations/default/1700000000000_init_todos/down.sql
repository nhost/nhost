-- Dropping the table takes its trigger with it, so the function is only
-- unreferenced once that has happened - hence this order.
drop table if exists public.todos;
drop function if exists public.touch_updated_at();

-- The files before the bucket they belong to, or the foreign key from
-- `storage.files` refuses the delete.
delete from storage.files
where bucket_id = 'todo-attachments';
delete from storage.buckets
where id = 'todo-attachments';
