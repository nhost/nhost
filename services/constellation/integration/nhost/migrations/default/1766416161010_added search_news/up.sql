CREATE FUNCTION search_news(search text)
  RETURNS SETOF news AS $$
      SELECT *
      FROM news
      WHERE
        title ILIKE ('%' || search || '%')
        OR content ILIKE ('%' || search || '%')
  $$ LANGUAGE sql STABLE;

CREATE FUNCTION search_news_2(search text)
  RETURNS SETOF news AS $$
      SELECT *
      FROM news
      WHERE
        title ILIKE ('%' || search || '%')
        OR content ILIKE ('%' || search || '%')
  $$ LANGUAGE sql STABLE;

CREATE FUNCTION search_news_3(search text)
  RETURNS SETOF news AS $$
      SELECT *
      FROM news
      WHERE
        title ILIKE ('%' || search || '%')
        OR content ILIKE ('%' || search || '%')
  $$ LANGUAGE sql STABLE;
