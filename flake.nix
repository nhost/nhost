{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/master";
    nix-filter.url = "github:numtide/nix-filter";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, nix-filter }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [
          (final: prev: rec {
            go = final.go_1_18;

            golangci-lint = prev.golangci-lint.override rec {
              buildGoModule = args: prev.buildGoModule.override { go = go; } (args // rec {
                version = "1.46.2";
                src = prev.fetchFromGitHub {
                  owner = "golangci";
                  repo = "golangci-lint";
                  rev = "v${version}";
                  sha256 = "sha256-7sDAwWz+qoB/ngeH35tsJ5FZUfAQvQsU6kU9rUHIHMk=";
                };
                vendorSha256 = "sha256-w38OKN6HPoz37utG/2QSPMai55IRDXCIIymeMe6ogIU=";

                meta = with final.lib; args.meta // {
                  broken = false;
                };
              });
            };

          })
        ];
        pkgs = import nixpkgs {
          inherit system overlays;
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
          go
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
              golangci-lint
            ] ++ buildInputs ++ nativeBuildInputs;
          };
        };

      }
    );
}
