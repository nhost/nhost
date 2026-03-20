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

  pg16 = mkPostgres pkgs.postgresql_16;
  pg17 = mkPostgres pkgs.postgresql_17;
  pg18 = mkPostgres pkgs.postgresql_18;
in
{
  check = nixops-lib.nix.check { src = nix-src; };

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
