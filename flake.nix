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
            go = final.go_1_20;

            golines = final.buildGoModule rec {
              name = "golines";
              version = "0.11.0";
              src = final.fetchFromGitHub {
                owner = "dbarrosop";
                repo = "golines";
                rev = "b7e767e781863a30bc5a74610a46cc29485fb9cb";
                sha256 = "sha256-pxFgPT6J0vxuWAWXZtuR06H9GoGuXTyg7ue+LFsRzOk=";
              };
              vendorHash = "sha256-rxYuzn4ezAxaeDhxd8qdOzt+CKYIh03A9zKNdzILq18=";

              meta = with final.lib; {
                description = "A golang formatter that fixes long lines";
                homepage = "https://github.com/segmentio/golines";
                maintainers = [ "nhost" ];
                platforms = platforms.linux ++ platforms.darwin;
              };
            };

            hasura-cli = prev.hasura-cli.override {
              buildGoModule = args: final.buildGoModule (args // rec {
                version = "2.24.1";
                src = final.fetchFromGitHub {
                  owner = "hasura";
                  repo = "graphql-engine";
                  rev = "v${version}";
                  sha256 = "sha256-/hGGjLEZ3czKpyisdpqvrKYMLEa0bFaNZCwo4FDJfgQ=";
                };

                ldflags = [
                  "-X github.com/hasura/graphql-engine/cli/v2/version.BuildVersion=${version}"
                  "-X github.com/hasura/graphql-engine/cli/v2/plugins.IndexBranchRef=master"
                  "-s"
                  "-w"
                  "-extldflags"
                  "\"-static\""
                ];
                vendorSha256 = "sha256-vZKPVQ/FTHnEBsRI5jOT6qm7noGuGukWpmrF8fK0Mgs=";
              });
            };

            golangci-lint = prev.golangci-lint.override rec {
              buildGoModule = args: prev.buildGoModule.override { go = go; } (args // rec {
                version = "1.52.2";
                src = prev.fetchFromGitHub {
                  owner = "golangci";
                  repo = "golangci-lint";
                  rev = "v${version}";
                  sha256 = "sha256-FmNXjOMDDdGxMQvy5f1NoaqrKFpmlPWclXooMxXP8zg";
                };
                vendorHash = "sha256-BhD3a0LNc3hpiH4QC8FpmNn3swx3to8+6gfcgZT8TLg=";

                meta = with final.lib; args.meta // {
                  broken = false;
                };
              });
            };

            gqlgenc = final.buildGoModule rec {
              pname = "gqlgenc";
              version = "0.13.5";

              src = final.fetchFromGitHub {
                owner = "Yamashou";
                repo = pname;
                rev = "v${version}";
                sha256 = "sha256-f4JkVYNLe93EO570k9MiBzOoGDSeJzY2dmM1yXbIE4k=";
              };

              vendorHash = "sha256-Up7Wi6z0Cbp9RHKAsjj/kd50UqcXtsS+ETRYuxRfGuA=";

              doCheck = false;

              subPackages = [ "./." ];

              meta = with final.lib; {
                description = "This is Go library for building GraphQL client with gqlgen";
                homepage = "https://github.com/Yamashou/gqlgenc";
                license = licenses.mit;
                maintainers = [ "@nhost" ];
              };
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
              gqlgenc
              gofumpt
              golines
              hasura-cli
              docker-compose
            ] ++ buildInputs ++ nativeBuildInputs;
          };
        };

      }
    );
}
