{
  description = "Nhost Hasura Storage";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nix-filter.url = "github:numtide/nix-filter";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, nix-filter }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        localOverlay = import ./nix/overlay.nix;
        overlays = [ localOverlay ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        go-src = nix-filter.lib.filter {
          root = ./.;
        };

        nix-src = nix-filter.lib.filter {
          root = ./.;
          include = [
            (nix-filter.lib.matchExt "nix")
          ];
        };

        buildInputs = with pkgs; [
          vips
        ];

        nativeBuildInputs = with pkgs; [
          go
          clang
          pkg-config
        ];

        name = "hasura-storage";
        version = nixpkgs.lib.fileContents ./VERSION;
        module = "github.com/nhost/hasura-storage";

        tags = "integration";

        ldflags = ''
          -X ${module}/controller.buildVersion=${version} \
        '';

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

          linters = pkgs.runCommand "linters"
            {
              nativeBuildInputs = with pkgs; [
                clang
                govulncheck
                golangci-lint
              ] ++ buildInputs ++ nativeBuildInputs;
            }
            ''
              export GOLANGCI_LINT_CACHE=$TMPDIR/.cache/golangci-lint
              export GOCACHE=$TMPDIR/.cache/go-build
              export GOMODCACHE="$TMPDIR/.cache/mod"

              mkdir $out
              cd $out
              cp -r ${go-src}/* .

              govulncheck ./...

              golangci-lint run \
                --build-tags=${tags} \
                --timeout 300s
            '';

          gotests = pkgs.runCommand "gotests"
            {
              nativeBuildInputs = with pkgs; [
                docker-client
                docker-compose
                govulncheck
                richgo
              ] ++ buildInputs ++ nativeBuildInputs;
            }
            ''
              export GOCACHE=$TMPDIR/.cache/go-build
              export GOMODCACHE="$TMPDIR/.cache/mod"

              mkdir $out
              cd $out
              cp -r ${go-src}/* .

              export HASURA_AUTH_BEARER=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE5ODAwNTYxNTAsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiJdLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXVzZXItaWQiOiJhYjViYTU4ZS05MzJhLTQwZGMtODdlOC03MzM5OTg3OTRlYzIiLCJ4LWhhc3VyYS11c2VyLWlzQW5vbnltb3VzIjoiZmFsc2UifSwiaWF0IjoxNjY0Njk2MTUwLCJpc3MiOiJoYXN1cmEtYXV0aCIsInN1YiI6ImFiNWJhNThlLTkzMmEtNDBkYy04N2U4LTczMzk5ODc5NGVjMiJ9.OMVYu-30oOuUNZeSbzhP0u0pq5bf-U2Z49LWkqr3hyc
              export TEST_S3_ACCESS_KEY=5a7bdb5f42c41e0622bf61d6e08d5537
              export TEST_S3_SECRET_KEY=9e1c40c65a615a5b52f52aeeaf549944ec53acb1dff4a0bf01fb58e969f915c8
              export GIN_MODE=release

              go test \
                -tags=${tags} \
                -ldflags="${ldflags}" \
                -v ./...
            '';

        };

        devShells = flake-utils.lib.flattenTree rec {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nixpkgs-fmt
              golangci-lint
              docker-client
              docker-compose
              go-migrate
              govulncheck
              gnumake
              gnused
              richgo
              ccls
              mockgen
            ] ++ buildInputs ++ nativeBuildInputs;
          };
        };

        packages = flake-utils.lib.flattenTree rec {
          hasuraStorage = pkgs.callPackage ./nix/hasura-storage.nix {
            inherit name version ldflags tags buildInputs nativeBuildInputs;
          };

          dockerImage = pkgs.dockerTools.buildLayeredImage {
            name = name;
            tag = version;
            created = "now";
            contents = [
              pkgs.cacert
            ] ++ buildInputs;
            config = {
              Env = [
                "TMPDIR=/"
                "MALLOC_ARENA_MAX=2"
              ];
              Entrypoint = [
                "${self.packages.${system}.hasuraStorage}/bin/hasura-storage"
              ];
            };
          };

          default = hasuraStorage;

        };

        apps = flake-utils.lib.flattenTree {
          hasuraStorage = self.packages.${system}.hasuraStorage;
          golangci-lint = pkgs.golangci-lint;
          default = self.packages.${system}.hasuraStorage;
        };

      }



    );


}
