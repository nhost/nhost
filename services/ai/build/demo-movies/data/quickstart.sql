ALTER TABLE public.movies
    DROP COLUMN outdated,
    DROP COLUMN embeddings;

DROP TRIGGER "set_outdated" ON "public"."movies";
DROP FUNCTION set_outdated_trigger();
