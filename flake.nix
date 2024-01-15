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
        overlays = [ nixops.overlays.default ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        src = nix-filter.lib.filter {
          root = ./.;
          include = with nix-filter.lib;[
            ".golangci.yaml"
            "go.mod"
            "go.sum"
            "ssl/.ssl/fullchain.pem"
            "ssl/.ssl/privkey.pem"
            (inDirectory "vendor")
            (inDirectory "cmd/config/testdata")
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

        nixops-lib = nixops.lib { inherit pkgs; };

        name = "nhost";
        description = "Nhost CLI";
        version = pkgs.lib.fileContents ./VERSION;
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
              goreleaser
              certbot-full
            ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
          };

          cibuild = pkgs.mkShell {
            buildInputs = with pkgs; [
              go
              goreleaser
            ];
          };
        };

        packages = flake-utils.lib.flattenTree rec {
          cli = nixops-lib.go.package {
            inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
          };
        };

      }
    );
}
