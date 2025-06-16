{
  inputs = {
    nixops.url = "github:nhost/nixops";
    nixpkgs.follows = "nixops/nixpkgs";
    flake-utils.follows = "nixops/flake-utils";
    nix-filter.follows = "nixops/nix-filter";
    nix2container.follows = "nixops/nix2container";
  };

  outputs = { self, nixops, nixpkgs, flake-utils, nix-filter, nix2container }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [
          nixops.overlays.default
          (final: prev: {
            certbot-full = prev.certbot.overrideAttrs (old: {
              doCheck = false;
            });
          })
        ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        src = nix-filter.lib.filter {
          root = ./.;
          include = with nix-filter.lib;[
            ".golangci.yaml"
            "go.mod"
            "go.sum"
            (inDirectory "ssl/.ssl")
            (inDirectory "vendor")
            (inDirectory "cmd/config/testdata")
            (inDirectory "cmd/project/templates")
            isDirectory
            (nix-filter.lib.matchExt "go")
            "get_access_token.sh"
            "gqlgenc.yaml"
            (inDirectory "nhostclient/graphql/query/")
          ];
        };

        nix-src = nix-filter.lib.filter {
          root = ./.;
          include = with nix-filter.lib;[
            (matchExt "nix")
          ];
        };

        checkDeps = with pkgs; [
          jq
          curl
          cacert
          gqlgenc
        ];

        buildInputs = with pkgs; [
        ];

        nativeBuildInputs = with pkgs; [
        ];

        nix2containerPkgs = nix2container.packages.${system};
        nixops-lib = nixops.lib { inherit pkgs nix2containerPkgs; };

        name = "cli";
        description = "Nhost CLI";
        version = "0.0.0-dev";
        created = "1970-01-01T00:00:00Z";
        module = "github.com/nhost/cli";
        submodule = ".";

        tags = [ ];

        ldflags = [
          "-X main.Version=${version}"
        ];
      in
      {
        checks = flake-utils.lib.flattenTree rec {
          nixpkgs-fmt = nixops-lib.nix.check { src = nix-src; };

          go-checks = nixops-lib.go.check {
            inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;

            preCheck = ''
              echo "➜ Getting access token"
              export NHOST_ACCESS_TOKEN=$(bash ${src}/get_access_token.sh)
            '';
          };
        };

        devShells = flake-utils.lib.flattenTree rec {
          default = nixops-lib.go.devShell {
            buildInputs = with pkgs; [
              certbot-full
              python312Packages.certbot-dns-route53
              skopeo
            ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
          };
        };

        packages = flake-utils.lib.flattenTree rec {
          cli = nixops-lib.go.package {
            inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
          };

          cli-arm64-darwin = (nixops-lib.go.package {
            inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
          }).overrideAttrs (old: old // {
            env = {
              GOOS = "darwin";
              GOARCH = "arm64";
              CGO_ENABLED = "0";
            };
          });

          cli-amd64-darwin = (nixops-lib.go.package {
            inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
          }).overrideAttrs (old: old // {
            env = {
              GOOS = "darwin";
              GOARCH = "amd64";
              CGO_ENABLED = "0";
            };
          });

          cli-arm64-linux = (nixops-lib.go.package {
            inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
          }).overrideAttrs (old: old // {
            env = {
              GOOS = "linux";
              GOARCH = "arm64";
              CGO_ENABLED = "0";
            };
          });

          cli-amd64-linux = (nixops-lib.go.package {
            inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
          }).overrideAttrs (old: old // {
            env = {
              GOOS = "linux";
              GOARCH = "amd64";
              CGO_ENABLED = "0";
            };
          });

          docker-image-arm64 = nixops-lib.go.docker-image {
            inherit name version created buildInputs;
            arch = "arm64";

            package = cli-arm64-linux;
          };

          docker-image-amd64 = nixops-lib.go.docker-image {
            inherit name version created buildInputs;
            arch = "amd64";

            package = cli-amd64-linux;
          };
        };

      }
    );
}

