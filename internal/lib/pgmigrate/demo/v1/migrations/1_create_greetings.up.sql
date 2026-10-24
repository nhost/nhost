CREATE TABLE hello.greetings (
    id integer PRIMARY KEY,
    message text NOT NULL
);
INSERT INTO hello.greetings (id, message) VALUES (1, 'Hello, world!');
