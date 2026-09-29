{ pkgs }:
let
  # Tools every Python check needs, independent of the interpreter a component
  # pins. ruff and uv come from nixpkgs rather than pip so the check resolves
  # the same versions on every machine.
  pythonCheckDeps = with pkgs; [
    ruff
    uv
    # Reads dependency lock files directly and reports known advisories. It is
    # a static scanner, so unlike pip-audit it needs neither pip nor a resolved
    # virtualenv, which nixpkgs' interpreters do not provide.
    osv-scanner
    # Its setup hook exports SSL_CERT_FILE, which httpx needs to build its
    # default TLS context and the advisory lookup needs to reach osv.dev.
    cacert
  ];

  # mypy and pytest are part of the check itself, so they are always present;
  # a component adds only the libraries its own code imports.
  mkPythonEnv =
    packages:
    pkgs.python3.withPackages (
      ps:
      [
        ps.mypy
        ps.pytest
        ps.pytest-asyncio
      ]
      ++ (packages ps)
    );

  # osv-scanner reports the lock format from the file name, so a lock that is
  # not literally called requirements.txt or uv.lock is passed with an explicit
  # format prefix.
  auditStep = auditLockfile: ''
    echo "➜ Checking dependencies for security advisories"
    osv-scanner scan source --lockfile=${auditLockfile}
  '';
in
{
  devShell =
    {
      pythonPackages ? (_: [ ]),
      buildInputs ? [ ],
      shellHook ? "",
    }:
    pkgs.mkShell {
      buildInputs =
        (with pkgs; [
          gnumake
          nixfmt
        ])
        ++ [ (mkPythonEnv pythonPackages) ]
        ++ pythonCheckDeps
        ++ buildInputs;

      inherit shellHook;
    };

  # check runs the steps every Python component in the repo shares: scan
  # dependencies for advisories, lint and format-check with ruff, type-check
  # with mypy, then run the tests. Component-specific work belongs in preCheck
  # (before the source is copied) or extraCheck (after), so no consumer has to
  # restate the boilerplate to add one step.
  check =
    {
      src,
      submodule ? "",
      # Selector for the libraries the component imports, e.g.
      # (ps: [ ps.httpx ps.pydantic ]).
      pythonPackages ? (_: [ ]),
      # Paths passed to ruff, mypy and pytest, relative to the working
      # directory. Kept separate because a component often lints its tests but
      # type-checks only its sources.
      lintPaths ? ".",
      typecheckPaths ? lintPaths,
      testPaths ? "",
      # Prepended to PYTHONPATH, relative to the copied source root. Examples
      # use it to import the SDK from source the way their editable install
      # resolves it.
      pythonPath ? "",
      # Lock file the advisory scan reads, relative to the working directory:
      # "requirements.txt", "uv.lock", or "<format>:<path>" for anything named
      # differently. Auditing is deliberately mandatory — opting out has to be
      # written down as `audit = false` in the consumer, not fall out of a
      # forgotten argument.
      audit ? true,
      auditLockfile ? null,
      buildInputs ? [ ],
      nativeBuildInputs ? [ ],
      checkDeps ? [ ],
      preCheck ? "",
      extraCheck ? "",
    }:
    assert pkgs.lib.assertMsg (!audit || auditLockfile != null)
      "nixops-lib.python.check: set auditLockfile (e.g. \"requirements.txt\" or \"uv.lock\"), or opt out explicitly with audit = false";
    pkgs.runCommand "pythontests"
      {
        # Checks that talk to the local backend started by `make dev-env-up`
        # have to reach outside the sandbox, and the advisory lookup needs the
        # network. Matching nixops-lib.go.check, this is unconditional so every
        # consumer behaves the same way.
        __noChroot = true;
        nativeBuildInputs = [
          (mkPythonEnv pythonPackages)
        ]
        ++ pythonCheckDeps
        ++ checkDeps
        ++ buildInputs
        ++ nativeBuildInputs;
      }
      ''
        set -eo pipefail
        export HOME=$(mktemp -d)

        ${preCheck}

        echo "➜ Source: ${src}"

        cp -r ${src} src
        chmod +w -R src
        cd src
        ${pkgs.lib.optionalString (pythonPath != "") ''
          export PYTHONPATH="$PWD/${pythonPath}''${PYTHONPATH:+:$PYTHONPATH}"
        ''}
        # "./" matters: a bare `cd` with an empty submodule goes to $HOME.
        cd "./${submodule}"

        ${pkgs.lib.optionalString audit (auditStep auditLockfile)}

        echo "➜ Running ruff (lint + format check)"
        ruff check ${lintPaths}
        ruff format --check ${lintPaths}

        echo "➜ Running mypy"
        mypy ${typecheckPaths}

        ${pkgs.lib.optionalString (testPaths != "") ''
          echo "➜ Running tests"
          pytest -rs ${testPaths}
        ''}

        ${extraCheck}

        mkdir $out
      '';
}
