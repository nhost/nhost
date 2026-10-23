{ pkgs }:
let
  # The path-flake check has no self.rev. Give only its test fixture a valid
  # revision so sync-ci exercises the published bundle's apply/check modes.
  sharedCI = import ./shared-ci.nix {
    inherit pkgs;
    revision = "0000000000000000000000000000000000000000";
  };
  src = pkgs.lib.fileset.toSource {
    root = ../.;
    fileset = pkgs.lib.fileset.unions [
      ../.github
      ../build/makefiles
      ../services/mcp/Makefile
      ../services/functions/Makefile
      ../services/postgres/Makefile
      ./README.md
      ./sync_ci.py
      (pkgs.lib.fileset.fileFilter (f: f.hasExt "py") ./tests)
    ];
  };
in
pkgs.runCommand "check-ci"
  {
    CI_FILES = sharedCI.files;
    SYNC_CI = "${sharedCI.sync}/bin/sync-ci";
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
    # Validate both exported workflows and all project-check callers in full.
    actionlint -config-file .github/actionlint.yaml \
      .github/workflows/wf_check.yaml \
      .github/workflows/wf_docker_push_image_ecr.yaml \
      .github/workflows/*checks.yaml
    shellcheck .github/actions/cache-nix/cache.sh
    python3 .github/actions/cache-nix/test_cache.py
    python3 -m unittest discover -s ci/tests -p 'test_*.py'

    mkdir "$out"
  ''
