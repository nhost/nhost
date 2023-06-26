{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nix-filter.url = "github:numtide/nix-filter";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, nix-filter }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        version = "v1.1.0";
        dist = {
          aarch64-darwin = rec {
            url = "https://github.com/nhost/cli/releases/download/${version}/cli-${version}-darwin-arm64.tar.gz";
            sha256 = "sha256-tF40CEkA357yzg2Gmc9ubjHJ5FlI9qQTdVdWNY/+f+Y=";
          };
          x86_64-linux = rec {
            url = "https://github.com/nhost/cli/releases/download/${version}/cli-${version}-linux-amd64.tar.gz";
            sha256 = "sha256-KLv06dI7A+5KGJ5F8xM1qC+oqHRmJ4kMaifLvaTFqak=";
          };
        };
        overlays = [
          (final: prev: rec {
            hasura-cli = prev.hasura-cli.override {
              buildGoModule = args: final.buildGoModule (args // rec {
                version = "2.15.2";
                src = final.fetchFromGitHub {
                  owner = "hasura";
                  repo = "graphql-engine";
                  rev = "v${version}";
                  sha256 = "sha256-q5Pk8K6WlkPMsegdKAqXXTFtPlN65Y1luoAsvjoW+20=";
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

            nhost = final.stdenvNoCC.mkDerivation rec {
              pname = "nhost-cli";
              inherit version;

              src = final.fetchurl {
                inherit (dist.${final.stdenvNoCC.hostPlatform.system} or
                  (throw "Unsupported system: ${final.stdenvNoCC.hostPlatform.system}")) url sha256;
              };


              sourceRoot = ".";

              nativeBuildInputs = [
                final.makeWrapper
                final.installShellFiles
              ];

              installPhase = ''
                runHook preInstall

                mkdir -p $out/bin
                mv cli $out/bin/nhost

                wrapProgram $out/bin/nhost --set HASURACLI ${final.hasura-cli}/bin/hasura

                installShellCompletion --cmd nhost \
                  --bash <($out/bin/nhost completion bash) \
                  --fish <($out/bin/nhost completion fish) \
                  --zsh <($out/bin/nhost completion zsh)

                runHook postInstall
              '';

              meta = with final.lib; {
                description = "Nhost CLI";
                homepage = "https://nhost.io";
                license = licenses.mit;
                maintainers = [ "@nhost" ];
              };


            };
          }
          )
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
              nhost
              nodejs_18
              # nodePackages.pnpm
            ] ++ buildInputs ++ nativeBuildInputs;
          };
        };

      }
    );
}
