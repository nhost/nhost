--
-- PostgreSQL database dump
--

\restrict az8Qp65TLVa6EOyk3bfyauALE7khBsEj4pXUu7Z8Pkq2931LNnBALZ1GLky2K2B

-- Dumped from database version 15.18 (Debian 15.18-1.pgdg13+1)
-- Dumped by pg_dump version 15.18 (Debian 15.18-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
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

\unrestrict az8Qp65TLVa6EOyk3bfyauALE7khBsEj4pXUu7Z8Pkq2931LNnBALZ1GLky2K2B

