CREATE TABLE auth.provider_requests (
  id uuid NOT NULL,
  redirect_url_success text NOT NULL,
  redirect_url_failure text NOT NULL,
  PRIMARY KEY (id)
);
