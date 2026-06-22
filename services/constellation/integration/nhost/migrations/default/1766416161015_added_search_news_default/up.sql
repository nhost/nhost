-- max_len defaults to 220 so that omitting it is OBSERVABLE: the seeded `news`
-- rows matching "a" have content lengths {194, 211, 218, 225, 228}, so the
-- default keeps the three rows <= 220 (a non-empty result) while a regression
-- that binds NULL or 0 instead of applying the default would return zero rows.
-- Supplying a smaller max_len (e.g. 200) then yields a strict, distinct subset.
CREATE FUNCTION search_news_default(search text, max_len int DEFAULT 220)
  RETURNS SETOF news AS $$
      SELECT *
      FROM news
      WHERE
        (title ILIKE ('%' || search || '%') OR content ILIKE ('%' || search || '%'))
        AND length(content) <= max_len
  $$ LANGUAGE sql STABLE;
