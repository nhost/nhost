{ self, pkgs, nix-filter, nixops-lib, nix2containerPkgs }:
let
  name = "nhost/postgres";
  version = "0.0.0-dev";

  src = nix-filter.lib.filter {
    root = ./.;
    include = with nix-filter.lib; [
      (inDirectory "postgres")
      (inDirectory "extensions")
      (inDirectory "tests")
      (matchExt "nix")
      "plugins.md"
    ];
  };

  mkPostgres = basePostgres: import ./postgres.nix {
    inherit name version pkgs nix2containerPkgs basePostgres;
  };

  mkAsDir = image: pkgs.runCommand "image-as-dir" { }
    "${image.copyTo}/bin/copy-to dir:$out";

  pg16 = mkPostgres pkgs.postgresql_16;
  pg17 = mkPostgres pkgs.postgresql_17;
  pg18 = mkPostgres pkgs.postgresql_18;
in
{
  check = pkgs.runCommand "check-postgres"
    {
      nativeBuildInputs = with pkgs;
        [
          postgresql_18
          diffutils
        ];
    }
    ''
      PG_URL="postgres://postgres@localhost:5432/local"

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
    buildInputs = with pkgs; [ wal-g docker-client skopeo ];
  };

  packages = rec {
    pg16-package = pg16.package;
    pg16-docker-image = pg16.dockerImage;
    pg16-as-dir = mkAsDir pg16-docker-image;
    pg17-package = pg17.package;
    pg17-docker-image = pg17.dockerImage;
    pg17-as-dir = mkAsDir pg17-docker-image;
    pg18-package = pg18.package;
    pg18-docker-image = pg18.dockerImage;
    pg18-as-dir = mkAsDir pg18-docker-image;
  };
}
