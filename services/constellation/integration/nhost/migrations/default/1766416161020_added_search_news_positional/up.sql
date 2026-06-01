-- Positional-only (unnamed) arguments: $1 required, $2 defaulted.
-- Exercises function calls for functions whose PostgreSQL arguments have no
-- names (named-argument call notation is impossible; positional notation must
-- be used, and a trailing default may be omitted).
-- The 220 default makes the omitted-argument behavior observable against the
-- seeded `news` rows matching "a" (lengths 194, 211, 218, 225, 228): omitting
-- arg_2 returns three rows, while binding NULL/0 would return none.
CREATE FUNCTION search_news_positional(text, int DEFAULT 220)
  RETURNS SETOF news AS $$
      SELECT *
      FROM news
      WHERE
        (title ILIKE ('%' || $1 || '%') OR content ILIKE ('%' || $1 || '%'))
        AND length(content) <= $2
  $$ LANGUAGE sql STABLE;
