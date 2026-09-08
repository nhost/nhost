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

  # The libraries this example imports. The interpreter, mypy, pytest, ruff and
  # the CA bundle come from nixops-lib.python.
  pythonPackages = ps: [
    # The SDK's runtime dependencies; it is imported from source below.
    ps.httpx
    ps.pydantic
    # The example's own dependency.
    ps.typer
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
  devShell = nixops-lib.python.devShell {
    inherit pythonPackages;
    buildInputs = [ pkgs.nhost.nhost-cli ];
  };

  # The tutorial pages are written against this program, so an example that
  # stops working against the SDK means the docs have gone stale. Linting and
  # type-checking it here is what keeps that from happening silently.
  check = nixops-lib.python.check {
    inherit src submodule pythonPackages;

    # See examples/demos/webhook-receiver/project.nix: requirements.txt holds
    # ranges rather than pinned versions, so an advisory scan would resolve them
    # against PyPI at build time and report on whatever was published today.
    # The SDK itself is scanned through its uv.lock.
    audit = false;

    lintPaths = "main.py test_main.py";
    typecheckPaths = "main.py";
    testPaths = "test_main.py";

    # Import the SDK from source, the way the example's editable install
    # (-e ../../../packages/nhost-python in requirements.txt) resolves it.
    pythonPath = "packages/nhost-python/src";
  };
}
