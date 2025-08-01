{
  description = "Nhost Hasura Auth";

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
          (import ./overlays.nix)
        ];

        pkgs = import nixpkgs {
          inherit overlays system;
        };

        node-src = nix-filter.lib.filter {
          root = ./.;
          include = with nix-filter.lib;[
            ./package.json
            ./bun.lock
            ./bunfig.toml
            ./tsconfig.json
            ./audit-ci.jsonc
            ./.env.example
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
            ./docs/openapi.yaml
            ./go/api/server.cfg.yaml
            ./go/api/types.cfg.yaml
            ./go/sql/schema.sh
            ./go/sql/sqlc.yaml
            ./go/sql/query.sql
            ./go/sql/auth_schema_dump.sql
            isDirectory
            (inDirectory "go/migrations/postgres")
            (inDirectory "email-templates")
            (inDirectory "vendor")
          ];
        };

        openapi-src = nix-filter.lib.filter {
          root = ./.;
          include = [
            ./docs/openapi.yaml
            ./vacuum.yaml
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
            bun
            cacert
          ];

          src = nix-filter.lib.filter {
            root = ./.;
            include = [
              ./package.json
              ./bun.lock
              ./bunfig.toml
            ];
          };

          buildPhase = ''
            bun install --frozen-lockfile
            rm -r node_modules/.cache
          '';

          installPhase = ''
            mkdir -p $out
            cp -r node_modules $out
          '';
        };

        name = "hasura-auth";
        description = "Nhost's Auth Service";
        version = "0.0.0-dev";
        created = "1970-01-01T00:00:00Z";
        module = "github.com/nhost/hasura-auth/go";
        submodule = ".";

        tags = [ ];

        ldflags = [
          "-X main.Version=${version}"
        ];

        buildInputs = [ ];

        nativeBuildInputs = [ ];

        checkDeps = with pkgs; [
          nhost-cli
          mockgen
          oapi-codegen
          sqlc
          postgresql_17_5-client
          vacuum-go
        ];


        nix2containerPkgs = nix2container.packages.${system};
        nixops-lib = nixops.lib { inherit pkgs nix2containerPkgs; };
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

          openapi = pkgs.runCommand "check-openapi"
            {
              nativeBuildInputs = with pkgs;
                [
                  vacuum-go
                ];
            }
            ''
              vacuum lint \
                -dqb -n info \
                --ruleset ${openapi-src}/vacuum.yaml \
                ${openapi-src}/docs/openapi.yaml
              mkdir -p $out
            '';

          go-checks = nixops-lib.go.check {
            inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;
          };

          node-checks = pkgs.runCommand "check-node"
            {
              nativeBuildInputs = with pkgs;
                [
                  bun
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

              bun test --env-file .env.example

              mkdir -p $out
            '';
        };

        devShells = flake-utils.lib.flattenTree rec {
          default = nixops-lib.go.devShell {
            buildInputs = with pkgs; [
              go-migrate
              skopeo
              bun
            ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
          };
        };

        packages = flake-utils.lib.flattenTree rec {
          hasura-auth = nixops-lib.go.package {
            inherit name submodule buildInputs description src version ldflags nativeBuildInputs;

            postInstall = ''
              mkdir $out/share
              cp -rv ${src}/email-templates $out/share/email-templates
            '';
          };

          docker-image = nixops-lib.go.docker-image {
            inherit name created version buildInputs;

            maxLayers = 100;
            contents = [ pkgs.wget ];

            package = hasura-auth;
          };

          default = hasura-auth;
        };
      }
    );
}
