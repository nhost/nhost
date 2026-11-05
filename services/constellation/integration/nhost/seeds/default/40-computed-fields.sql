INSERT INTO cf_select.items (id, owner_id, label, amount, payload) VALUES
    (1, 1, 'first', 12.5, '{"status":"ready"}'),
    (2, 2, 'second', 3.25, '{"status":"waiting"}');
INSERT INTO cf_select.tags (id, item_id, label) VALUES
    (1, 1, 'one'), (2, 1, 'two'), (3, 2, 'three');
INSERT INTO cf_predicates.rules (id, owner_id, label) VALUES
    (1, 1, 'visible'), (2, 2, 'hidden');
