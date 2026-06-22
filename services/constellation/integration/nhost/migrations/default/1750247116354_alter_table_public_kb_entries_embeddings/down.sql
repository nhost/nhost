DELETE FROM graphite.auto_embeddings_configuration
WHERE id = 'c7850e66-d275-4ae0-a5c5-4573a6c325f1';

-- Drop the trigger
DROP TRIGGER IF EXISTS set_outdated ON "public"."kb_entries";

-- Drop the trigger function
DROP FUNCTION IF EXISTS set_outdated_trigger();

-- Remove the columns
ALTER TABLE "public"."kb_entries" DROP COLUMN IF EXISTS "embeddings_outdated";
ALTER TABLE "public"."kb_entries" DROP COLUMN IF EXISTS "embeddings";
