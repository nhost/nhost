{
  inputs = {
    nixops.url = "github:nhost/nhost";
    nixpkgs.follows = "nixops/nixpkgs";
    flake-utils.follows = "nixops/flake-utils";
  };

  outputs =
    {
      self,
      nixops,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            nixops.overlays.default
          ];
        };

        fs = pkgs.lib.fileset;
        nix-src = fs.toSource {
          root = ../.;
          fileset = fs.unions [
            ../flake.lock
            ../flake.nix
            (fs.fileFilter (f: f.hasExt "nix") ./.)
          ];
        };
      in
      {
        checks = {
          nixpkgs-fmt =
            pkgs.runCommand "check-nixpkgs-fmt"
              {
                nativeBuildInputs = with pkgs; [
                  nixpkgs-fmt
                ];
              }
              ''
                mkdir $out
                nixpkgs-fmt --check ${nix-src}
              '';
        };

        devShells = flake-utils.lib.flattenTree rec {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_22
              pnpm
              # Required by next-sitemap.config.js to derive per-page `lastmod`
              # from the last git commit that touched each source file.
              git
            ];
          };
        };

      }
    );
}
