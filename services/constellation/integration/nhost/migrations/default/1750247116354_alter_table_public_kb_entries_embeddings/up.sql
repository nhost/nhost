alter table "public"."kb_entries" add column "embeddings" vector(1536)
 null;

alter table "public"."kb_entries" add column "embeddings_outdated" boolean
 not null default 'true';

-- Create a trigger that sets "outdated" to true if the columns
-- "title", "summary" or "content" are updated
CREATE OR REPLACE FUNCTION set_outdated_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.title <> OLD.title OR NEW.summary <> OLD.summary OR NEW.content <> OLD.content THEN
        NEW.embeddings_outdated := true;
    ELSEIF NEW.embeddings IS NOT NULL THEN
        NEW.embeddings_outdated := false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the table
CREATE TRIGGER set_outdated
BEFORE UPDATE ON "kb_entries"
FOR EACH ROW
EXECUTE FUNCTION set_outdated_trigger();

-- INSERT INTO graphite.auto_embeddings_configuration VALUES ('c7850e66-d275-4ae0-a5c5-4573a6c325f1', '2025-06-18 12:28:43.029236+00', '2025-06-18 12:28:43.029236+00', 'kb_entries', 'public', 'kb_entries', 'embeddings', NULL, 'query GetOutdatedKBEntries {
--   kb_entries(where: {
--     _or: [
--       {embeddings: {_is_null: true}},
--       {embeddings_outdated: {_eq: true},
--     },
--   ]}) {
--     id
--     title
--     summary
--     content
--   }
-- }', 'mutation UpdateEmbeddingsKBEntry($id: uuid!, $embeddings: vector) {
--   update_kb_entries_by_pk(pk_columns: {id: $id}, _set: {embeddings: $embeddings}) {
--     __typename
--   }
-- }', 'text-embedding-ada-002');
