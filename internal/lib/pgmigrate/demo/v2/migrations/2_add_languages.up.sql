ALTER TABLE hello.greetings ADD COLUMN language text NOT NULL DEFAULT 'en';
UPDATE hello.greetings SET message = 'Hello, migrations!' WHERE id = 1;
INSERT INTO hello.greetings (id, message, language) VALUES (2, 'Hola, mundo!', 'es');
