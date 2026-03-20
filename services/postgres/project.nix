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

  pg16_13 = mkPostgres pkgs.postgresql_16_13;
  pg17_9 = mkPostgres pkgs.postgresql_17_9;
  pg18_3 = mkPostgres pkgs.postgresql_18_3;
in
{
  check = nixops-lib.nix.check { src = nix-src; };

  devShell = pkgs.mkShell {
    buildInputs = with pkgs; [ wal-g docker-client skopeo ];
  };

  packages = rec {
    pg16_13-package = pg16_13.package;
    pg16_13-docker-image = pg16_13.dockerImage;
    pg16_13-as-dir = mkAsDir pg16_13-docker-image;
    pg17_9-package = pg17_9.package;
    pg17_9-docker-image = pg17_9.dockerImage;
    pg17_9-as-dir = mkAsDir pg17_9-docker-image;
    pg18_3-package = pg18_3.package;
    pg18_3-docker-image = pg18_3.dockerImage;
    pg18_3-as-dir = mkAsDir pg18_3-docker-image;
  };
}
