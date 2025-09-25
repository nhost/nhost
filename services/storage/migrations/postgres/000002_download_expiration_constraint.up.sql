ALTER TABLE storage.buckets
    ADD CONSTRAINT download_expiration_valid_range
        CHECK (download_expiration >= 1 AND download_expiration <= 604800);
