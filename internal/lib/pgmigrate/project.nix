{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "pgmigrate";
  version = "0.0.0-dev";
  submodule = "internal/lib/${name}";

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ../../..;
    fileset = fs.unions [
      ../../../go.mod
      ../../../go.sum
      ../../../vendor
      ../../../.golangci.yaml
      ../../../govulncheck.yaml
      (fs.fileFilter (f: f.hasExt "go") ./.)
    ];
  };

  tags = [ ];
  ldflags = [ ];

  checkDeps = with pkgs; [
    mockgen
    nhost.postgresql_18
  ];

  buildInputs = [ ];
  nativeBuildInputs = [ ];
in
{
  check = nixops-lib.go.check {
    inherit
      src
      submodule
      ldflags
      tags
      buildInputs
      nativeBuildInputs
      checkDeps
      ;

    preCheck = ''
      export PGMIGRATE_TEST_DATABASE_REQUIRED=1
      export PGDATA="$TMPDIR/pgmigrate-postgres"
      export PGMIGRATE_SOCKET_DIR="$(mktemp -d /tmp/pgmigrate.XXXXXX)"

      stop_pgmigrate_postgres() {
        if test -f "$PGDATA/postmaster.pid"; then
          pg_ctl -D "$PGDATA" -m fast -w stop
        fi
        rm -rf "$PGMIGRATE_SOCKET_DIR"
      }
      trap stop_pgmigrate_postgres EXIT INT TERM

      initdb --auth=trust --no-locale --encoding=UTF8 -D "$PGDATA"
      pg_ctl \
        -D "$PGDATA" \
        -l "$PGDATA/server.log" \
        -o "-F -h ''' -k $PGMIGRATE_SOCKET_DIR" \
        -w start

      export PGMIGRATE_TEST_DSN="host=$PGMIGRATE_SOCKET_DIR dbname=postgres sslmode=disable"
    '';

    extraCheck = ''
      stop_pgmigrate_postgres
      trap - EXIT INT TERM
    '';
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = checkDeps ++ buildInputs ++ nativeBuildInputs;
  };
}
