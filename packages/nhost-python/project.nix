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

  # The libraries this package imports. The interpreter, mypy, pytest, ruff, uv
  # and the CA bundle come from nixops-lib.python.
  pythonPackages = ps: [
    ps.httpx
    ps.pydantic
  ];

  # codegen is the prebuilt binary; gen.sh prefers it over `go run`.
  codegen = self.packages.${pkgs.system}.codegen;

  checkDeps = [ codegen ];

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
      ../../docs/src/content/docs/getting-started/index.mdx
      ../../docs/src/content/docs/getting-started/quickstart/fastapi.mdx
      ../../docs/src/content/docs/getting-started/tutorials/python
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
  devShell = nixops-lib.python.devShell {
    inherit pythonPackages;
    buildInputs = checkDeps ++ [ pkgs.nhost.nhost-cli ];
  };

  check = nixops-lib.python.check {
    inherit
      src
      submodule
      pythonPackages
      checkDeps
      ;

    # The advisory scan this package previously had no equivalent of: uv.lock
    # pins the resolved dependency set, so that is what gets scanned.
    auditLockfile = "uv.lock";

    lintPaths = "src tests conftest.py";
    testPaths = "tests";

    # The SDK is imported from source, the way the editable install resolves it.
    pythonPath = "${submodule}/src";

    # Both checks answer "does the committed tree match its inputs", so they run
    # before anything is linted or executed. gen.sh rewrites the clients and
    # `uv lock` can rewrite the lock, so both run against a throwaway copy
    # instead of the tree the rest of the check reads.
    preCheck = ''
      echo "➜ Checking generated clients are up to date (codegen + ruff)"
      mkdir -p $TMPDIR/gen
      cp -r ${src}/* $TMPDIR/gen
      chmod +w -R $TMPDIR/gen
      (cd $TMPDIR/gen/${submodule} && ./gen.sh)
      diff ${src}/${submodule}/src/nhost/auth/client.py \
        $TMPDIR/gen/${submodule}/src/nhost/auth/client.py \
        || (echo "❌ auth/client.py is stale; run ./gen.sh" && exit 1)
      diff ${src}/${submodule}/src/nhost/storage/client.py \
        $TMPDIR/gen/${submodule}/src/nhost/storage/client.py \
        || (echo "❌ storage/client.py is stale; run ./gen.sh" && exit 1)

      echo "➜ Checking uv.lock is in sync with pyproject.toml"
      (cd $TMPDIR/gen/${submodule} \
        && UV_CACHE_DIR="$TMPDIR/uv-cache" uv lock --check --offline)
      echo ""
    '';

    # The doctests are run twice, once without a backend and once with, and each
    # run asserts a known example was actually collected: a doctest suite that
    # silently collects nothing passes, which is the failure mode these canaries
    # exist to catch.
    extraCheck = ''
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
    '';
  };

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
