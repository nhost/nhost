--
-- PostgreSQL database dump
--

\restrict QpIlIbHhzKRcoT2MSmv851W5p2JNl3AKkehwl55H3YaL9BnpA7gKRLNHhaF2rpt

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Debian 18.4-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: todos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: todos_title_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX todos_title_idx ON public.todos USING btree (title);


--
-- PostgreSQL database dump complete
--

\unrestrict QpIlIbHhzKRcoT2MSmv851W5p2JNl3AKkehwl55H3YaL9BnpA7gKRLNHhaF2rpt

