-- Reproduction for the composite-FK + defaulted-discriminator insert-check bug.
--
-- Mirrors the neogym workout_session_strength_sets shape: a child table whose
-- object relationship to its parent is a *composite* FK (parent_id, parent_kind)
-- where parent_kind is NOT supplied by the client — it has a DEFAULT and a CHECK
-- pinning it. The child's insert permission reaches the owner *through* that
-- composite-FK relationship, so the join column parent_kind must carry its
-- default value ('strength') for the check to pass.

CREATE TABLE public.exercise_logs (
  id       uuid NOT NULL DEFAULT gen_random_uuid(),
  kind     text NOT NULL,
  owner_id uuid NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (id, kind)
);

CREATE TABLE public.exercise_log_sets (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id   uuid NOT NULL,
  parent_kind text NOT NULL DEFAULT 'strength'
                CONSTRAINT exercise_log_sets_parent_kind_check CHECK (parent_kind = 'strength'),
  reps        integer,
  CONSTRAINT exercise_log_sets_parent_fk
    FOREIGN KEY (parent_id, parent_kind)
    REFERENCES public.exercise_logs(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE
);
