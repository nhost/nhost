{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/master";
    nix-filter.url = "github:numtide/nix-filter";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, nix-filter }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        name = "nhost";
        version = pkgs.lib.fileContents ./VERSION;
        description = "Nhost CLI";

        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            (import ./nix/overlay.nix)
          ];
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
          ];
        };

        nix-src = nix-filter.lib.filter {
          root = ./.;
          include = with nix-filter.lib;[
            (matchExt "nix")
          ];
        };

        goCheckDeps = with pkgs; [
          golangci-lint
          gofumpt
          golines
          gqlgenc
          govulncheck
          richgo
        ];

        buildInputs = with pkgs; [
        ];

        nativeBuildInputs = with pkgs; [
          go
        ];

        tags = [ ];
        ldflags = [
          "-X main.Version=${version}"
        ];
      in
      {
        checks = flake-utils.lib.flattenTree rec {
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

          go = pkgs.runCommand "gotests"
            {
              nativeBuildInputs = goCheckDeps ++ buildInputs ++ nativeBuildInputs;
            }
            ''
              export GOLANGCI_LINT_CACHE=$TMPDIR/.cache/golangci-lint
              export GOCACHE=$TMPDIR/.cache/go-build
              export GOMODCACHE="$TMPDIR/.cache/mod"
              export GOPATH="$TMPDIR/.cache/gopath"

              echo "➜ Source: ${src}"

              echo "➜ Running go generate ./... and checking sha1sum of all files"
              mkdir -p $TMPDIR/generate
              cd $TMPDIR/generate
              cp -r ${src}/* .
              chmod +w -R .

              go generate ./...
              find . -type f ! -path "./vendor/*" -print0 | xargs -0 sha1sum > $TMPDIR/sum
              cd ${src}
              sha1sum -c $TMPDIR/sum || (echo "❌ ERROR: go generate changed files" && exit 1)

              echo "➜ Running code formatters, if there are changes, fail"
              golines -l --base-formatter=gofumpt . | diff - /dev/null

              echo "➜ Checking for vulnerabilities"
              govulncheck ./...

              echo "➜ Running golangci-lint"
              golangci-lint run \
                --timeout 300s \
                ./...

              echo "➜ Running tests"
              richgo test \
                -tags="${pkgs.lib.strings.concatStringsSep " " tags}" \
                -ldflags="${pkgs.lib.strings.concatStringsSep " " ldflags}" \
                -v ./...

              mkdir $out
            '';
        };

        devShells = flake-utils.lib.flattenTree rec {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              goreleaser
              certbot-full
            ] ++ goCheckDeps ++ buildInputs ++ nativeBuildInputs;
          };

          cibuild = pkgs.mkShell {
            buildInputs = with pkgs; [
              go
              goreleaser
            ];
          };
        };

        packages = flake-utils.lib.flattenTree rec {
          cli = pkgs.buildGoModule {
            inherit src version ldflags buildInputs nativeBuildInputs;

            pname = name;

            vendorSha256 = null;

            doCheck = false;

            CGO_ENABLED = 1;

            meta = with pkgs.lib; {
              description = description;
              homepage = "https://github.com/nhost/cli";
              maintainers = [ "nhost" ];
              platforms = platforms.linux ++ platforms.darwin;
            };
          };

        };

      }
    );
}
