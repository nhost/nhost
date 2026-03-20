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
    ];
  };

  nix-src = nix-filter.lib.filter {
    root = ./.;
    include = [ (nix-filter.lib.matchExt "nix") ];
  };

  mkPostgres = basePostgres: import ./postgres.nix {
    inherit name version pkgs nix2containerPkgs basePostgres;
  };

  mkAsDir = image: pkgs.runCommand "image-as-dir" { }
    "${image.copyTo}/bin/copy-to dir:$out";

  pg16_11 = mkPostgres pkgs.postgresql_16_11;
  pg17_7 = mkPostgres pkgs.postgresql_17_7;
  pg18_1 = mkPostgres pkgs.postgresql_18_1;
in
{
  check = nixops-lib.nix.check { src = nix-src; };

  devShell = pkgs.mkShell {
    buildInputs = with pkgs; [ wal-g docker-client skopeo ];
  };

  packages = rec {
    pg16_11-package = pg16_11.package;
    pg16_11-docker-image = pg16_11.dockerImage;
    pg16_11-as-dir = mkAsDir pg16_11-docker-image;
    pg17_7-package = pg17_7.package;
    pg17_7-docker-image = pg17_7.dockerImage;
    pg17_7-as-dir = mkAsDir pg17_7-docker-image;
    pg18_1-package = pg18_1.package;
    pg18_1-docker-image = pg18_1.dockerImage;
    pg18_1-as-dir = mkAsDir pg18_1-docker-image;
  };
}
