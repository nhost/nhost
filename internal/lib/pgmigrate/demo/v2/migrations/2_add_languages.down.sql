DELETE FROM hello.greetings WHERE id = 2;
UPDATE hello.greetings SET message = 'Hello, world!' WHERE id = 1;
ALTER TABLE hello.greetings DROP COLUMN language;
