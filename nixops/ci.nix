{ pkgs }:
let
  src = pkgs.lib.fileset.toSource {
    root = ../.;
    fileset = pkgs.lib.fileset.unions [
      ../.github
      ../build/makefiles
      ../services/mcp/Makefile
      ../services/functions/Makefile
      ../services/postgres/Makefile
      (pkgs.lib.fileset.fileFilter (f: f.hasExt "py") ./tests)
    ];
  };
in
pkgs.runCommand "check-ci"
  {
    nativeBuildInputs = with pkgs; [
      actionlint
      bash
      coreutils
      findutils
      gnugrep
      gnumake
      gnused
      jq
      (python3.withPackages (p: [ p.pyyaml ]))
      shellcheck
      zip
    ];
  }
  ''
    cp -r ${src}/. source
    cd source
    chmod u+w .
    mkdir .git

    # Other workflows still use newer action inputs than actionlint knows.
    # Validate the shared workflow and all its project-check callers in full.
    actionlint -config-file .github/actionlint.yaml \
      .github/workflows/wf_check.yaml .github/workflows/*checks.yaml
    shellcheck .github/actions/cache-nix/cache.sh
    python3 .github/actions/cache-nix/test_cache.py
    python3 -m unittest discover -s nixops/tests -p 'test_*.py'

    mkdir "$out"
  ''
