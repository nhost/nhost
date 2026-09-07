{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-python-tutorial";
  version = "0.0.0-dev";
  submodule = "examples/tutorials/${name}";

  fs = pkgs.lib.fileset;

  # Interpreter plus the example's own dependencies. Using nixpkgs-provided
  # packages (not uv) keeps the check reproducible, and mirrors how the SDK's
  # own check builds its environment.
  pythonEnv = pkgs.python3.withPackages (ps: [
    # The SDK's runtime dependencies; it is imported from source below.
    ps.httpx
    ps.pydantic
    # The example's own dependency.
    ps.typer
    # Test tooling.
    ps.pytest
    ps.mypy
  ]);

  checkDeps = [
    pythonEnv
    pkgs.ruff
    # Provides a CA bundle (its setup hook sets SSL_CERT_FILE) so httpx can
    # build its default TLS context.
    pkgs.cacert
  ];

  # Rooted at the repo so the SDK this example imports is available.
  src = fs.toSource {
    root = ../../..;
    fileset = fs.unions [
      ./main.py
      ./test_main.py
      ./requirements.txt
      ./ruff.toml
      ./mypy.ini
      ./README.md
      ../../../packages/nhost-python/pyproject.toml
      ../../../packages/nhost-python/src
    ];
  };
in
{
  devShell = pkgs.mkShell {
    buildInputs = checkDeps ++ [
      pkgs.uv
      pkgs.nhost.nhost-cli
    ];
  };

  # The tutorial pages are written against this program, so an example that
  # stops working against the SDK means the docs have gone stale. Linting and
  # type-checking it here is what keeps that from happening silently.
  check =
    pkgs.runCommand "${name}-tests"
      {
        nativeBuildInputs = checkDeps;
      }
      ''
        set -eo pipefail
        export HOME=$(mktemp -d)

        cp -r ${src} src
        chmod +w -R src
        cd src
        # Import the SDK from source, the way the example's editable install
        # (-e ../../../packages/nhost-python in requirements.txt) resolves it.
        export PYTHONPATH="$PWD/packages/nhost-python/src"
        cd ${submodule}

        echo "➜ Running ruff (lint + format check)"
        ruff check main.py test_main.py
        ruff format --check main.py test_main.py

        echo "➜ Running mypy (strict, via mypy.ini)"
        mypy main.py

        echo "➜ Running the behavioural example tests"
        pytest -rs test_main.py

        mkdir $out
      '';
}
