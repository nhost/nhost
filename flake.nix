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
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            nixops.overlays.default
            (import ./nix/overlay.nix)
          ];
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

        node_modules = pkgs.stdenv.mkDerivation {
          version = "0.0.0-dev";

          pname = "node_modules";

          nativeBuildInputs = with pkgs; [
            pnpm_9
            cacert
            nodejs
          ];

          src = nix-filter.lib.filter {
            root = ./.;
            include = [
              ./.npmrc
              ./pnpm-workspace.yaml
              # find . -name package.json | grep -v node_modules
              ./docs/package.json
              ./dashboard/package.json
              ./integrations/stripe-graphql-js/package.json
              ./integrations/google-translation/package.json
              ./integrations/react-urql/package.json
              ./integrations/react-apollo/package.json
              ./integrations/apollo/package.json
              ./package.json
              ./examples/react-gqty/package.json
              ./examples/cli/package.json
              ./examples/vue-quickstart/package.json
              ./examples/serverless-functions/package.json
              ./examples/vue-apollo/package.json
              ./examples/codegen-react-urql/package.json
              ./examples/react-apollo/package.json
              ./examples/multi-tenant-one-to-many/package.json
              ./examples/node-storage/package.json
              ./examples/nextjs/package.json
              ./examples/codegen-react-query/package.json
              ./examples/docker-compose/package.json
              ./examples/docker-compose/functions/package.json
              ./examples/seed-data-storage/package.json
              ./examples/codegen-react-apollo/package.json
              ./examples/quickstarts/nhost-backend/functions/package.json
              ./examples/quickstarts/nextjs-server-components/package.json
              ./examples/quickstarts/sveltekit/package.json
              ./packages/graphql-js/package.json
              ./packages/nhost-js/package.json
              ./packages/nhost-js/functions/package.json
              ./packages/vue/package.json
              ./packages/hasura-storage-js/package.json
              ./packages/hasura-storage-js/functions/package.json
              ./packages/sync-versions/package.json
              ./packages/nextjs/package.json
              ./packages/docgen/package.json
              ./packages/hasura-auth-js/package.json
              ./packages/hasura-auth-js/functions/package.json
              ./packages/react/package.json
              #find . -name pnpm-lock.yaml | grep -v node_modules
              ./pnpm-lock.yaml
              ./examples/cli/pnpm-lock.yaml
              ./examples/vue-apollo/pnpm-lock.yaml
              ./examples/react-apollo/pnpm-lock.yaml
              ./examples/node-storage/pnpm-lock.yaml
              ./examples/nextjs/pnpm-lock.yaml
              ./examples/quickstarts/nhost-backend/functions/pnpm-lock.yaml
              ./examples/quickstarts/sveltekit/pnpm-lock.yaml
              ./packages/nhost-js/functions/pnpm-lock.yaml
              ./packages/hasura-storage-js/functions/pnpm-lock.yaml
              ./packages/hasura-auth-js/functions/pnpm-lock.yaml
            ];
          };

          buildPhase = ''
            pnpm --version
            pnpm install --frozen-lockfile
          '';

          installPhase = ''
            mkdir -p $out
            cp -r node_modules $out
          '';
        };
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
              nhost-cli
              nodejs
              pnpm_9
              go
              golangci-lint
            ] ++ buildInputs ++ nativeBuildInputs;

            # shellHook = ''
            #   rm -rf node_modules
            #   ln -sf ${node_modules}/node_modules/ node_modules
            # '';
          };
        };

      }
    );
}
