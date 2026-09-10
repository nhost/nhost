{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "webhook-receiver";
  version = "0.0.0-dev";
  submodule = "examples/demos/${name}";

  fs = pkgs.lib.fileset;

  # The libraries this example imports. The interpreter, mypy, pytest, ruff and
  # the CA bundle come from nixops-lib.python.
  pythonPackages = ps: [
    # The SDK's runtime dependencies; it is imported from source below.
    ps.httpx
    ps.pydantic
    # The example's own dependencies.
    ps.fastapi
    ps.uvicorn
  ];

  # Rooted at the repo so the SDK this example imports is available.
  src = fs.toSource {
    root = ../../..;
    fileset = fs.unions [
      ./app.py
      ./test_app.py
      ./requirements.in
      ./requirements.txt
      ./requirements-dev.txt
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

  # This example receives untrusted external input, so its body-size limits and
  # signature verification carry real weight; test_app.py pins that behaviour
  # and the check runs it.
  check = nixops-lib.python.check {
    inherit src submodule pythonPackages;

    # requirements.txt is compiled from requirements.in and pins every
    # transitive dependency, so osv-scanner reads exactly what the Dockerfile
    # installs and resolves nothing against PyPI itself. The editable SDK line
    # is skipped by the scanner, which is correct: the SDK is scanned through
    # its own uv.lock.
    auditLockfile = "requirements.txt";

    lintPaths = "app.py test_app.py";
    typecheckPaths = "app.py";
    testPaths = "test_app.py";

    # Import the SDK from source, the way the example's editable install
    # (-e ../../../packages/nhost-python in requirements.txt) resolves it.
    pythonPath = "packages/nhost-python/src";
  };
}
