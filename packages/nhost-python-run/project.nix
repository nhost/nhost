{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-python-run";
  version = "0.0.0-dev";
  submodule = "packages/${name}";

  fs = pkgs.lib.fileset;

  # Python interpreter + dev/runtime dependencies from nixpkgs (not uv) so the
  # check is reproducible and ruff/mypy run on NixOS.
  pythonEnv = pkgs.python3.withPackages (ps: [
    ps.pytest
    ps.mypy
    ps.uvicorn
  ]);

  checkDeps = [
    pythonEnv
    pkgs.ruff
  ];

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../.gitignore
      ./pyproject.toml
      ./README.md
      ./src
      ./tests
    ];
  };

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
      pkgs.nhost.nhost-cli
    ];
  };

  # No backend or codegen: a pure ASGI helper, so this runs hermetically.
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
        cd src/${submodule}
        export PYTHONPATH="$PWD/src"

        echo "➜ Running ruff (lint + format check)"
        ruff check src tests
        ruff format --check src tests

        echo "➜ Running mypy --strict"
        mypy --strict src/nhost_run

        echo "➜ Running the test suite"
        pytest -q

        mkdir $out
      '';

  package = pkgs.python3.pkgs.buildPythonPackage {
    pname = "nhost-run";
    inherit version;
    pyproject = true;
    src = pkgSrc;

    build-system = [ pkgs.python3.pkgs.hatchling ];
    dependencies = [ pkgs.python3.pkgs.uvicorn ];

    pythonImportsCheck = [ "nhost_run" ];
  };
}
