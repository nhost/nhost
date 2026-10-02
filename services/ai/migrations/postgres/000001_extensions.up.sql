-- AI service data will be stored in this schema
SET ROLE postgres;
-- We need this extension to store and work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;
-- This extension is used to be able to call the AI service to
-- generate embeddings directly from a postgres function
CREATE EXTENSION IF NOT EXISTS http;
