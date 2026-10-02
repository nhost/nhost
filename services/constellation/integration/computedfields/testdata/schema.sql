CREATE SCHEMA cf_fixture;

CREATE TABLE cf_fixture.items (
    id integer PRIMARY KEY,
    label text NOT NULL
);

-- Kept untracked until computed-field metadata and execution are implemented.
CREATE FUNCTION cf_fixture.item_label(row_arg cf_fixture.items)
RETURNS text LANGUAGE sql STABLE AS $$
    SELECT row_arg.label
$$;
