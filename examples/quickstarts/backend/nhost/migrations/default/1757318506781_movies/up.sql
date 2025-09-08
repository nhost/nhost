CREATE TABLE movies (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  director VARCHAR(255),
  release_year INTEGER,
  genre VARCHAR(100),
  rating FLOAT
);

INSERT INTO movies (title, director, release_year, genre, rating) VALUES
  ('Inception', 'Christopher Nolan', 2010, 'Sci-Fi', 8.8),
  ('The Godfather', 'Francis Ford Coppola', 1972, 'Crime', 9.2),
  ('Forrest Gump', 'Robert Zemeckis', 1994, 'Drama', 8.8),
  ('The Matrix', 'Lana Wachowski, Lilly Wachowski', 1999, 'Action', 8.7);

