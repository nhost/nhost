SET check_function_bodies = false;
CREATE TABLE public.enum (
    key text NOT NULL,
    value text NOT NULL
);
CREATE TABLE public.test (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);
ALTER TABLE ONLY public.enum
    ADD CONSTRAINT enum_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.test
    ADD CONSTRAINT test_pkey PRIMARY KEY (id);
SET check_function_bodies = false;
INSERT INTO public.enum (key, value) VALUES ('tasdas', 'asdasf');
