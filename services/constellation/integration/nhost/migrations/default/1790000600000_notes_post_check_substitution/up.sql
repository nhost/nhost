-- Reproduction for the nested array-relationship + post-check + parent-CTE
-- substitution bug. Mirrors the queries-package fixture in
-- services/constellation/connector/sql/graphql/queries/testdata/pg_schema.sql.
--
-- The child's insert check references both a sibling relationship to the
-- parent (notes.author_id, walked via the note_id FK) AND a DB-defaulted
-- column on the child itself (visibility), so requiresPostInsertCheck fires
-- for the child. When inserted as the nested side of an array relationship
-- from notes, buildSingleInsertCTEPostCheck (single-row) /
-- buildMultiNestedInsertCTEPostCheck (multi-row) must thread tableSubs so
-- the post-check's EXISTS reads from mutation_result (the parent's in-flight
-- CTE) instead of the underlying empty public.notes table.

CREATE TABLE public.notes (
  id        uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid NOT NULL,
  title     text NOT NULL
);

CREATE TABLE public.note_replies (
  id         uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id    uuid NOT NULL REFERENCES public.notes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'public'
               CONSTRAINT note_replies_visibility_check CHECK (visibility IN ('public', 'private')),
  body       text NOT NULL
);
