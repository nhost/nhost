-- Fixture for a nested array relationship whose child insert check reads
-- both its DB-defaulted visibility and the parent through a relationship.
-- Mirrors the queries-package fixture in
-- services/constellation/connector/sql/graphql/queries/testdata/pg_schema.sql.
-- The parent row is inserted before the child, so the child's check reads
-- its own inserted row and sees the parent in the base table.

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
