# Nhost Python SDK conventions

Async-first Python SDK exposing the top-level package `nhost`. Mirrors the
architecture of `packages/nhost-js` and `packages/nhost-swift`.

## Build and checks

- Dev workflow uses `uv`: `uv pip install -e .` then `make test-local`,
  `uv run mypy src tests conftest.py`, and `uv run ruff check src tests conftest.py`.
- `uv.lock` is committed and CI enforces `uv lock --check --offline`; update it
  whenever dependency declarations in `pyproject.toml` change.
- `ruff` is a prebuilt Rust binary and does not run on bare NixOS; run
  formatting/linting inside the Nix dev shell (adds a patched `ruff`).
- Python 3.11+; `httpx` and `pydantic` v2 are the only runtime dependencies.
- mypy runs in `strict` mode with the `pydantic.mypy` plugin enabled — the
  plugin is required so alias/`populate_by_name` construction typechecks.

## Source layout (`src/nhost`)

- `fetch/` — the middleware pipeline core (`FetchResponse`, `HTTPError`,
  `ChainFunction`, `create_enhanced_fetch`, JSON helpers) plus `middleware.py`
  (token attach, session refresh, response capture, role/headers/admin). The
  middleware is re-exported from `fetch/__init__.py` at the *bottom* of the file
  so the core names are defined before the middleware transitively imports back
  from this package (session → auth → fetch).
- `auth/client.py`, `storage/client.py` — GENERATED (see below). Hand-written
  `facade.py` modules add convenience names without modifying generated identifiers.
- `graphql/`, `functions/` — hand-written clients.
- `session/` — `StoredSession`/`DecodedToken` + JWT decode, storage backends
  (`MemoryStorage` default, `FileStorage`), the `SessionStorage` wrapper, and
  async `refresh_session` (serialized with an asyncio lock).
- `nhost.py` — `NhostClient` + `create_client` / `create_server_client` /
  `create_nhost_client` factories and configuration functions. Session refreshes use a
  dedicated bare auth client; never add user-facing or session middleware to that client.

## Generated code

- Generator source and tests live in the `nhost-python-codegen` worktree;
  generated SDK outputs live here. Keep those changes in their respective branches.
- Regenerate with `./gen.sh` (auth + storage from the OpenAPI specs under
  `services/`). Generation is deterministic and must stay idempotent.
- Generated files carry a generated header and must pass Ruff and strict mypy;
  never hand-edit them.
- Generated models are pydantic `BaseModel`s with snake_case fields and
  `Field(alias=<wireName>)` + `ConfigDict(populate_by_name=True, extra="allow")`; the SDK
  serializes with `by_alias=True, exclude_none=True`.
- `StoredSession` subclasses the generated `Session`; `session/session.py`
  imports `User` and calls `StoredSession.model_rebuild()` so the `Session.user`
  forward reference resolves in that namespace.

## Testing

- Unit tests use `httpx.MockTransport` (no network I/O): pass a mock-backed
  `httpx.AsyncClient` as the keyword-only `http_client=` argument. Run the unit tests
  and offline doctests with `make test-local`.
- Docstring examples are executable documentation (the Python counterpart of
  nhost-js's `docstrings.test.ts`), run via `pytest --doctest-modules` as part of
  `make test-local`. `conftest.py` gates them: pure examples like
  `generate_service_url` always run; backend-dependent examples (listed by
  fully-qualified name in `_BACKEND_DEPENDENT_DOCTESTS`) and anything marked
  `@pytest.mark.integration` are skipped unless `NHOST_LOCAL_BACKEND=1`.
- Backend examples and marked integration tests use
  `subdomain="local", region="local"`; bring the backend up with
  `make dev-env-up` then run `make integration-local`, which executes both.
- When editing a backend-only example, add its qualified doctest name to
  `_BACKEND_DEPENDENT_DOCTESTS` in `conftest.py`, or the offline suite will try
  to run it and fail. Doctest collection raises an error if a configured name no
  longer exists, so rename the matching entry with the example.
- `make integration-local` has been verified against the backend started by
  `make dev-env-up`; without that backend it must fail rather than report a skip.
