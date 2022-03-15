{
  description = "Nhost Hasura Storage";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
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
          imagemagick
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

          golangci-lint = pkgs.runCommand "golangci-lint"
            {
              nativeBuildInputs = with pkgs; [
                clang
                golangci-lint
              ] ++ nativeBuildInputs;
            }
            ''
              export GOLANGCI_LINT_CACHE=$TMPDIR/.cache/golangci-lint
              export GOCACHE=$TMPDIR/.cache/go-build
              export GOMODCACHE="$TMPDIR/.cache/mod"

              mkdir $out
              cd $out
              cp -r ${go-src}/* .

              golangci-lint run \
                --build-tags=${tags} \
                --timeout 300s
            '';

          gotests = pkgs.runCommand "gotests"
            {
              nativeBuildInputs = with pkgs; [
                docker-client
                docker-compose
                richgo
              ] ++ buildInputs ++ nativeBuildInputs;
            }
            ''
              export GOCACHE=$TMPDIR/.cache/go-build
              export GOMODCACHE="$TMPDIR/.cache/mod"

              mkdir $out
              cd $out
              cp -r ${go-src}/* .

              export HASURA_AUTH_BEARER=$(make dev-jwt)
              export TEST_S3_ACCESS_KEY=$(make dev-s3-access-key)
              export TEST_S3_SECRET_KEY=$(make dev-s3-secret-key)
              export GIN_MODE=release

              go test \
                -tags=${tags} \
                -ldflags="${ldflags}" \
                -v ./...
            '';

        };

        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [
            nixpkgs-fmt
            golangci-lint
            docker-client
            docker-compose
            go-migrate
            gnumake
            gnused
            richgo
          ] ++ buildInputs ++ nativeBuildInputs;
        };

        packages = flake-utils.lib.flattenTree
          {
            hasuraStorage = pkgs.callPackage ./nix/hasura-storage.nix {
              inherit name version ldflags tags buildInputs nativeBuildInputs;
            };

            dockerImage = pkgs.dockerTools.buildImage {
              name = name;
              tag = version;
              created = "now";
              contents = [
                pkgs.cacert
              ] ++ buildInputs;
              config = {
                Entrypoint = [
                  "${self.packages.${system}.hasuraStorage}/bin/hasura-storage"
                ];
              };
            };

          };

        defaultPackage = self.packages.${system}.hasuraStorage;

        apps = flake-utils.lib.flattenTree
          {
            hasuraStorage = self.packages.${system}.hasuraStorage;
            golangci-lint = pkgs.golangci-lint;
          };

        defaultApp = self.packages.${system}.hasuraStorage;

      }



    );


}
