{
  description = "Nhost Hasura Auth";

  inputs = {
    nixops.url = "github:nhost/nixops";
    nixpkgs.follows = "nixops/nixpkgs";
    flake-utils.follows = "nixops/flake-utils";
    nix-filter.follows = "nixops/nix-filter";
  };

  outputs = { self, nixops, nixpkgs, flake-utils, nix-filter }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [
          nixops.overlays.default
          (final: prev: {
            nodejs = prev.nodejs_20;
          })
        ];

        pkgs = import nixpkgs {
          inherit overlays system;
        };

        node-src = nix-filter.lib.filter {
          root = ./.;
          include = with nix-filter.lib;[
            ./package.json
            ./pnpm-lock.yaml
            ./tsconfig.build.json
            ./tsconfig.json
            ./audit-ci.jsonc
            ./jest.config.js
            ./.env.example
            (inDirectory "migrations")
            (inDirectory "src")
            (inDirectory "types")
            (inDirectory "email-templates")
            (inDirectory "test")
          ];

          exclude = with nix-filter.lib;[
            ./node_modules
          ];
        };

        src = nix-filter.lib.filter {
          root = ./.;
          include = with nix-filter.lib;[
            (nix-filter.lib.matchExt "go")
            (nix-filter.lib.matchExt "gotmpl")
            ./go.mod
            ./go.sum
            ./.golangci.yaml
            ./go/api/openapi.yaml
            ./go/api/server.cfg.yaml
            ./go/api/types.cfg.yaml
            ./go/sql/schema.sh
            ./go/sql/sqlc.yaml
            ./go/sql/query.sql
            ./go/sql/auth_schema_dump.sql
            isDirectory
            (inDirectory "email-templates")
            (inDirectory "vendor")
          ];
        };

        nix-src = nix-filter.lib.filter {
          root = ./.;
          include = [
            (nix-filter.lib.matchExt "nix")
          ];
        };

        node_modules-builder = pkgs.stdenv.mkDerivation {
          inherit version;

          pname = "node_modules-builder";

          nativeBuildInputs = with pkgs; [
            nodePackages.pnpm
            cacert
          ];

          src = nix-filter.lib.filter {
            root = ./.;
            include = [
              ./package.json
              ./pnpm-lock.yaml
            ];
          };

          buildPhase = ''
            pnpm install --frozen-lockfile
          '';

          installPhase = ''
            mkdir -p $out
            cp -r node_modules $out
          '';
        };

        node_modules-prod = node_modules-builder.overrideAttrs (oldAttrs: {
          name = "node_modules-prod";

          buildPhase = ''
            pnpm install --frozen-lockfile --prod
          '';
        });


        name = "hasura-auth";
        description = "Nhost's Auth Service";
        version = "0.0.0-dev";
        module = "github.com/nhost/hasura-auth/go";
        submodule = ".";

        tags = [ ];

        ldflags = [
          "-X main.Version=${version}"
        ];

        buildInputs = with pkgs; [ ];

        nativeBuildInputs = with pkgs; [
          makeWrapper
        ];

        checkDeps = with pkgs; [
          nhost-cli
          mockgen
          oapi-codegen
          sqlc
          postgresql_16_4-client
        ];


        nixops-lib = nixops.lib { inherit pkgs; };

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

          go-checks = nixops-lib.go.check {
            inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;
          };

          node-checks = pkgs.runCommand "check-node"
            {
              nativeBuildInputs = with pkgs;
                [
                  nodejs-slim_20
                  nodePackages.pnpm
                  cacert
                ];
            }
            ''
              echo ${src} > /dev/null # force rebuild if src changes
              mkdir -p $TMPDIR/auth
              cd $TMPDIR/auth
              cp -r ${node-src}/* .
              cp -r ${node-src}/.* .
              ln -s ${node_modules-builder}/node_modules node_modules

              export XDG_DATA_HOME=$TMPDIR/.local/share
              export HOME=$TMPDIR

              echo "➜ Running pnpm audit"
              pnpx audit-ci --config ./audit-ci.jsonc
              echo "➜ Running pnpm build"
              pnpm build
              echo "➜ Running pnpm test"
              cp .env.example .env
              pnpm test

              mkdir -p $out
            '';
        };

        devShells = flake-utils.lib.flattenTree rec {
          default = nixops-lib.go.devShell {
            buildInputs = with pkgs; [
              go-migrate
              nodejs
              nodePackages.pnpm
            ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
          };
        };

        packages = flake-utils.lib.flattenTree rec {
          node-auth = pkgs.stdenv.mkDerivation {
            inherit version;
            pname = "node-${name}";

            buildInputs = with pkgs; [
              pkgs.nodejs-slim_20
            ];

            nativeBuildInputs = with pkgs; [
              nodePackages.pnpm
            ];

            src = node-src;

            buildPhase = ''
              ln -s ${node_modules-builder}/node_modules node_modules
              pnpm build
            '';

            installPhase = ''
              mkdir -p $out/bin
              cp -r dist $out/dist
              cp -r migrations $out/migrations
              cp -r email-templates $out/email-templates
              cp package.json $out/package.json
              ln -s ${node_modules-prod}/node_modules $out/node_modules
            '';
          };

          hasura-auth = nixops-lib.go.package {
            inherit name submodule description src version ldflags nativeBuildInputs;

            buildInputs = with pkgs; [
              node-auth
            ] ++ buildInputs;

            postInstall = ''
              wrapProgram $out/bin/hasura-auth \
                  --suffix PATH : ${pkgs.nodejs-slim_20}/bin \
                  --prefix AUTH_NODE_SERVER_PATH : ${node-auth}
            '';
          };

          docker-image = nixops-lib.go.docker-image {
            inherit name version buildInputs;

            contents = with pkgs; [
              wget
            ];

            package = hasura-auth;
          };

          default = hasura-auth;
        };
      }
    );
}
