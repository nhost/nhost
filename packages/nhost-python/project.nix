{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-python";
  # Matches the PEP 440 version hatchling reads from pyproject.toml so the
  # derivation name reflects the actual wheel version. Release automation must
  # bump this and pyproject.toml together; the shared get-version target does
  # not rewrite this project's PEP 440 development-version sentinel.
  version = "0.0.0.dev0";
  submodule = "packages/${name}";

  fs = pkgs.lib.fileset;

  # Python interpreter + all runtime/dev dependencies. Using nixpkgs-provided
  # packages (not uv) keeps the check reproducible and gives us a ruff/mypy that
  # actually run on NixOS.
  pythonEnv = pkgs.python3.withPackages (ps: [
    ps.httpx
    ps.pydantic
    ps.pytest
    ps.pytest-asyncio
    ps.mypy
  ]);

  # codegen is the prebuilt binary; gen.sh prefers it over `go run`.
  codegen = self.packages.${pkgs.system}.codegen;

  checkDeps = [
    pythonEnv
    pkgs.ruff
    pkgs.uv
    codegen
    # Provides a CA bundle (its setup hook sets SSL_CERT_FILE) so httpx can
    # build its default TLS context when talking to the backend.
    pkgs.cacert
  ];

  # Source used by the check: rooted at the repo so gen.sh can resolve the
  # shared OpenAPI specs via REPO_ROOT (../..), mirroring nhost-js.
  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../.gitignore
      ./pyproject.toml
      ./uv.lock
      ./README.md
      ./Makefile
      ./gen.sh
      ./conftest.py
      ./src
      ./tests
      ../../services/auth/docs/openapi.yaml
      ../../services/storage/controller/openapi.yaml
    ];
  };

  # A trimmed source rooted at the package for building the wheel.
  pkgSrc = fs.toSource {
    root = ./.;
    fileset = fs.unions [
      ./pyproject.toml
      ./README.md
      ./src
    ];
  };
in
{
  devShell = pkgs.mkShell {
    buildInputs = checkDeps ++ [ pkgs.nhost.nhost-cli ];
  };

  check =
    pkgs.runCommand "nhost-python-tests"
      {
        # Integration doctests talk to the local backend started by
        # `make dev-env-up`; the check must run outside the sandbox to reach it.
        __noChroot = true;
        nativeBuildInputs = checkDeps;
      }
      ''
        set -eo pipefail
        export HOME=$(mktemp -d)

        cp -r ${src} src
        chmod +w -R src
        cd src/${submodule}
        export PYTHONPATH="$PWD/src"

        echo "➜ Checking generated clients are up to date (codegen + ruff)"
        cp src/nhost/auth/client.py "$TMPDIR/auth.before"
        cp src/nhost/storage/client.py "$TMPDIR/storage.before"
        ./gen.sh
        diff "$TMPDIR/auth.before" src/nhost/auth/client.py \
          || (echo "❌ auth/client.py is stale; run ./gen.sh" && exit 1)
        diff "$TMPDIR/storage.before" src/nhost/storage/client.py \
          || (echo "❌ storage/client.py is stale; run ./gen.sh" && exit 1)

        echo "➜ Checking uv.lock is in sync with pyproject.toml"
        UV_CACHE_DIR="$TMPDIR/uv-cache" uv lock --check --offline

        echo "➜ Running ruff (lint + format check)"
        ruff check src tests conftest.py
        ruff format --check src tests conftest.py

        echo "➜ Running mypy --strict over source, tests, and pytest configuration"
        mypy src tests conftest.py

        echo "➜ Running the offline unit suite (no backend)"
        pytest tests

        echo "➜ Running offline doctests (backend examples skip)"
        pytest --doctest-modules --import-mode=importlib src -rs -vv \
          | tee "$TMPDIR/offline-doctests.log"
        # Positive canary: this known pure doctest must be collected and pass.
        grep -qF \
          'src/nhost/nhost.py::nhost.nhost.generate_service_url PASSED' \
          "$TMPDIR/offline-doctests.log" \
          || (echo "❌ pure doctest canary did not pass" && exit 1)

        echo "➜ Running integration doctests against the local backend"
        export NHOST_LOCAL_BACKEND=1
        pytest --doctest-modules --import-mode=importlib src -rs -vv \
          | tee "$TMPDIR/integration-doctests.log"
        # Positive canary: the known backend doctest must execute and pass.
        grep -qF \
          'src/nhost/nhost.py::nhost.nhost.create_client PASSED' \
          "$TMPDIR/integration-doctests.log" \
          || (echo "❌ backend doctest canary did not pass" && exit 1)

        echo "➜ Running marked integration tests against the local backend"
        pytest tests -m integration -rs -vv \
          | tee "$TMPDIR/integration-tests.log"
        # Positive canary: tests/ integration markers must be collected and execute.
        grep -qF \
          'tests/test_sdk.py::test_local_backend_graphql_integration PASSED' \
          "$TMPDIR/integration-tests.log" \
          || (echo "❌ marked integration test canary did not pass" && exit 1)

        mkdir $out
      '';

  package = pkgs.python3.pkgs.buildPythonPackage {
    # The flake output remains `nhost-python`; package metadata uses the
    # distribution name declared in pyproject.toml.
    pname = "nhost";
    inherit version;
    pyproject = true;
    src = pkgSrc;

    build-system = [ pkgs.python3.pkgs.hatchling ];
    dependencies = with pkgs.python3.pkgs; [
      httpx
      pydantic
    ];

    # Validate that the installed wheel exposes its public import package.
    pythonImportsCheck = [ "nhost" ];
  };
}
