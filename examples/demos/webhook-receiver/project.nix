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

    # No advisory scan, because there is nothing here to scan deterministically.
    # requirements.txt is a list of ranges (`fastapi>=0.115`), not a lock, and
    # osv-scanner resolves ranges against PyPI as it runs: `fastapi>=0.115`
    # became 0.141.1 with a full transitive tree, so the result would change
    # with upstream releases rather than with this repository. A check that goes
    # red because someone else published a package teaches people to ignore it.
    #
    # The SDK is scanned properly through its uv.lock. Auditing these examples
    # means giving them real lock files first.
    audit = false;

    lintPaths = "app.py test_app.py";
    typecheckPaths = "app.py";
    testPaths = "test_app.py";

    # Import the SDK from source, the way the example's editable install
    # (-e ../../../packages/nhost-python in requirements.txt) resolves it.
    pythonPath = "packages/nhost-python/src";
  };
}
