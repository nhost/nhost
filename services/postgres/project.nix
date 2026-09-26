{
  self,
  pkgs,
  nixops-lib,
  nix2containerPkgs,
}:
let
  name = "nhost/postgres";
  version = "0.0.0-dev";

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ./.;
    fileset = fs.unions [
      ./postgres
      ./extensions
      ./tests
      (fs.fileFilter (f: f.hasExt "nix") ./.)
      ./plugins.md
    ];
  };

  mkPostgres =
    basePostgres:
    import ./postgres.nix {
      inherit
        name
        version
        pkgs
        nix2containerPkgs
        basePostgres
        ;
    };

  mkAsDir = image: pkgs.runCommand "image-as-dir" { } "${image.copyTo}/bin/copy-to dir:$out";

  pg17 = mkPostgres pkgs.nhost.postgresql_17;
  pg18 = mkPostgres pkgs.nhost.postgresql_18;
in
{
  check =
    pkgs.runCommand "check-postgres"
      {
        __noChroot = true;
        nativeBuildInputs = with pkgs; [
          nhost.postgresql_18
          diffutils
        ];
      }
      ''
        PG_URL="postgres://postgres@localhost:5432/local"

        sh ${src}/tests/pitr-promotion.sh \
          ${src}/postgres/bin/init.sh
        sh ${src}/tests/pitr-restore.sh \
          ${src}/postgres/bin/init.sh
        sh ${src}/tests/wal-fetch.sh \
          ${src}/postgres/bin/wal-fetch.sh
        sh ${src}/tests/startup-scripts.sh \
          ${src}/postgres/bin/init.sh
        sh ${src}/tests/repair-collation.sh \
          ${src}/postgres/bin/repair-collation.sh
        PGHOST=localhost PGPORT=5432 \
          sh ${src}/tests/repair-collation-integration.sh \
            ${src}/postgres/bin/repair-collation.sh

        psql \
          -f ${src}/tests/plugins.sql --no-psqlrc -1 -v "ON_ERROR_STOP=1" \
          "$PG_URL"

        # Verify plugins.md is up to date (only for PG18)
        PG_MAJOR=$(psql --no-psqlrc -t -A -c "SHOW server_version_num;" "$PG_URL" | head -c2)
        if [ "$PG_MAJOR" = "18" ]; then
          {
            echo "| Name | Version | Description |"
            echo "| ---- | ------- | ----------- |"
            psql --no-psqlrc -t -A -F '|' \
              -c "SELECT name, default_version, comment FROM pg_available_extensions ORDER BY name ASC;" \
              "$PG_URL" \
              | sed 's/^/| /; s/$/|/'
          } > expected-plugins.md

          diff -u ${src}/plugins.md expected-plugins.md || \
            (echo "ERROR: plugins.md is out of date. Run 'make get-plugin-versions' and commit the result." && exit 1)
        fi

        mkdir $out
      '';

  devShell = pkgs.mkShell {
    buildInputs = with pkgs; [
      nhost.wal-g
      docker-client
      skopeo
    ];
  };

  packages = rec {
    pg17-package = pg17.package;
    pg17-docker-image = pg17.dockerImage;
    pg17-as-dir = mkAsDir pg17-docker-image;
    pg18-package = pg18.package;
    pg18-docker-image = pg18.dockerImage;
    pg18-as-dir = mkAsDir pg18-docker-image;
  };
}
