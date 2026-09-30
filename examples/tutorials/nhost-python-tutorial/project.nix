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
      ./requirements.in
      ./requirements.txt
      ./ruff.toml
      ./mypy.ini
      ./README.md
      ./docs_snippets.py
      # The tutorial pages, whose programs the check type-checks.
      ../../../docs/src/content/docs/getting-started/tutorials/python
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

    # requirements.txt is compiled from requirements.in with every transitive
    # dependency pinned, so the advisory scan reads the file rather than
    # resolving ranges against PyPI as it runs.
    auditLockfile = "requirements.txt";

    lintPaths = "main.py test_main.py";
    typecheckPaths = "main.py";
    testPaths = "test_main.py";

    # Import the SDK from source, the way the example's editable install
    # (-e ../../../packages/nhost-python in requirements.txt) resolves it.
    pythonPath = "packages/nhost-python/src";

    # The pages end each part with the complete main.py, and nothing else
    # checks those. Lint and type-check each with the same settings as
    # main.py, and check the collapse/highlight ranges still match the diff
    # between consecutive parts. See docs_snippets.py.
    extraCheck = ''
      pages=../../../docs/src/content/docs/getting-started/tutorials/python

      echo "➜ Checking the tutorial pages' collapse/highlight ranges"
      python3 docs_snippets.py "$pages" ranges

      echo "➜ Checking the tutorial pages' programs"
      python3 docs_snippets.py "$pages" extract docs_parts
      ruff check docs_parts
      ruff format --check docs_parts
      mypy docs_parts/*.py
    '';
  };
}
