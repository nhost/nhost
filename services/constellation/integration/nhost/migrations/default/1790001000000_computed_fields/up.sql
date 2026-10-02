CREATE SCHEMA cf_select;
CREATE TABLE cf_select.items (
    id integer PRIMARY KEY,
    owner_id integer NOT NULL,
    label text NOT NULL,
    amount numeric NOT NULL,
    payload jsonb NOT NULL
);
CREATE TABLE cf_select.tags (
    id integer PRIMARY KEY,
    item_id integer NOT NULL REFERENCES cf_select.items(id),
    label text NOT NULL
);

CREATE FUNCTION cf_select.item_label(item cf_select.items)
RETURNS text LANGUAGE sql STABLE AS $$ SELECT item.label $$;
CREATE FUNCTION cf_select.item_score(item cf_select.items, multiplier integer DEFAULT 1)
RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount * multiplier $$;
CREATE FUNCTION cf_select.item_second(multiplier integer, item cf_select.items)
RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount * multiplier $$;
CREATE FUNCTION cf_select.item_payload(item cf_select.items)
RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT item.payload $$;
CREATE FUNCTION cf_select.item_tags(item cf_select.items)
RETURNS SETOF cf_select.tags LANGUAGE sql STABLE AS $$
    SELECT t.* FROM cf_select.tags AS t WHERE t.item_id = item.id ORDER BY t.id
$$;

CREATE SCHEMA cf_predicates;
CREATE TABLE cf_predicates.rules (
    id integer PRIMARY KEY,
    owner_id integer NOT NULL,
    label text NOT NULL
);
CREATE FUNCTION cf_predicates.rule_visible(rule cf_predicates.rules)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT rule.owner_id = 1 $$;
