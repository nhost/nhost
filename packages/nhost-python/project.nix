{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-python";
  version = "0.0.0-dev";
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
    buildInputs = checkDeps ++ [
      pkgs.uv
      pkgs.nhost-cli
    ];
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

        echo "➜ Running ruff (lint + format check)"
        ruff check src tests
        ruff format --check src tests

        echo "➜ Running mypy --strict (hand-written code)"
        mypy src/nhost/fetch src/nhost/session src/nhost/graphql \
          src/nhost/functions src/nhost/nhost.py

        echo "➜ Running the offline unit + doctest suite (no backend)"
        pytest -q
        # Streamed via tee so failures are visible in the build log; pipefail
        # (set above) propagates pytest's exit status through the pipe.
        pytest --doctest-modules --import-mode=importlib src tests -rs \
          | tee "$TMPDIR/offline.log"
        # Canary: pure doctests must have run, so not everything is skipped.
        grep -qE '[1-9][0-9]* passed' "$TMPDIR/offline.log" \
          || (echo "❌ offline doctests did not run" && exit 1)

        echo "➜ Running integration doctests against the local backend"
        export NHOST_LOCAL_BACKEND=1
        pytest --doctest-modules --import-mode=importlib src tests -rs \
          | tee "$TMPDIR/integ.log"
        # Fail loudly if the backend examples were silently skipped: with the
        # backend flag set they must all execute.
        if grep -q 'needs a local Nhost backend' "$TMPDIR/integ.log"; then
          echo "❌ backend doctests were skipped even though NHOST_LOCAL_BACKEND=1" \
            "(is the backend up? run make dev-env-up)"
          exit 1
        fi

        mkdir $out
      '';

  package = pkgs.python3.pkgs.buildPythonPackage {
    pname = name;
    inherit version;
    pyproject = true;
    src = pkgSrc;

    build-system = [ pkgs.python3.pkgs.hatchling ];
    dependencies = with pkgs.python3.pkgs; [
      httpx
      pydantic
    ];

    # No import check here — the wheel build already validates packaging.
    pythonImportsCheck = [ "nhost" ];
  };
}
