-- Drop the trigger
DROP TRIGGER IF EXISTS set_outdated ON "movies";

-- Drop the trigger function
DROP FUNCTION IF EXISTS set_outdated_trigger();

-- Remove the "outdated" column
ALTER TABLE "movies" DROP COLUMN IF EXISTS "outdated";

-- Remove the "embeddings" column
ALTER TABLE "movies" DROP COLUMN IF EXISTS "embeddings";
