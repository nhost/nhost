{
  inputs = {
    nixops.url = "github:nhost/nixops";
    nixpkgs.follows = "nixops/nixpkgs";
    flake-utils.follows = "nixops/flake-utils";
    nix-filter.follows = "nixops/nix-filter";
  };

  outputs = { self, nixops, nixpkgs, flake-utils, nix-filter }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            nixops.overlays.default
          ];
        };

        nix-src = nix-filter.lib.filter {
          root = ./.;
          include = [
            (nix-filter.lib.matchExt "nix")
          ];
        };

        buildInputs = with pkgs; [
        ];

        nativeBuildInputs = with pkgs; [
        ];
      in
      {
        checks = {
          nixpkgs-fmt = pkgs.runCommand "check-nixpkgs-fmt"
            {
              nativeBuildInputs = with pkgs;
                [
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
              nodePackages.pnpm
            ] ++ buildInputs ++ nativeBuildInputs;
          };
        };

      }
    );
}
