SET ROLE postgres;
CREATE EXTENSION IF NOT EXISTS postgis;
RESET ROLE;

CREATE TABLE public.postgis_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  geom          geometry(Point, 4326) NOT NULL,
  geog          geography(Point, 4326) NOT NULL,
  area          geometry(Polygon, 4326) NOT NULL,
  nullable_geom geometry(Point, 4326)
);
