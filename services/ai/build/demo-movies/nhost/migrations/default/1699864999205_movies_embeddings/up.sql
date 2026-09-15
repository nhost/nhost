-- Add the "embeddings" column of type "vector(1536)" that can be nullable
ALTER TABLE "movies" ADD COLUMN "embeddings" vector(1536);

-- Add the "outdated" column of type "boolean" with a default value of true
ALTER TABLE "movies" ADD COLUMN "outdated" boolean DEFAULT true;

-- Create a trigger that sets "outdated" to true if the columns "name", "genre", "overview" or "crew" are updated
CREATE OR REPLACE FUNCTION set_outdated_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name <> OLD.name OR NEW.genre <> OLD.genre OR NEW.overview <> OLD.overview OR NEW.crew <> OLD.crew THEN
        NEW.outdated := true;
    ELSEIF NEW.embeddings IS NOT NULL THEN
        NEW.outdated := false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the table
CREATE TRIGGER set_outdated
BEFORE UPDATE ON "movies"
FOR EACH ROW
EXECUTE FUNCTION set_outdated_trigger();
