{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-filter.url = "github:numtide/nix-filter";
    nix2container.url = "github:nlewo/nix2container";
    nix2container.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, flake-utils, nix-filter, nix2container }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            (import ./nixops/overlays/default.nix)
          ];
        };

        lib = import ./nixops/lib/lib.nix;

        nix2containerPkgs = nix2container.packages.${system};
        nixops-lib = lib { inherit pkgs nix2containerPkgs; };

        node_modules = nixops-lib.js.mkNodeModules {
          name = "node-modules";
          version = "0.0.0-dev";

          src = nix-filter.lib.filter {
            root = ./.;
            include = [
              ./.npmrc
              ./pnpm-workspace.yaml
              ./pnpm-lock.yaml

              # find . -name package.json | grep -v node_modules | grep -v deprecated
              ./package.json
              ./docs/package.json
              ./dashboard/package.json
              ./packages/nhost-js/package.json
            ];
          };
        };

        codegenf = import ./tools/codegen/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };

        dashboardf = import ./dashboard/project.nix {
          inherit self pkgs nix-filter nixops-lib node_modules nix2containerPkgs;
        };

        docsf = import ./docs/project.nix {
          inherit self pkgs nix-filter nixops-lib node_modules;
        };

        mintlify-openapif = import ./tools/mintlify-openapi/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };

        nhost-jsf = import ./packages/nhost-js/project.nix {
          inherit self pkgs nix-filter nixops-lib node_modules;
        };

        nixopsf = import ./nixops/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };
      in
      {
        #nixops
        overlays.default = import ./overlays/default.nix;
        lib = lib;

        checks = {
          codegen = codegenf.check;
          dashboard = dashboardf.check;
          docs = docsf.check;
          mintlify-openapi = mintlify-openapif.check;
          nhost-js = nhost-jsf.check;
          nixops = nixopsf.check;
        };

        devShells = flake-utils.lib.flattenTree {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              gh
              gnused
              nodePackages.vercel
              playwright-driver
              nhost-cli
              nodejs
              pnpm_10
              biome
              skopeo
              go
              golines
              gofumpt
              golangci-lint
              self.packages.${system}.codegen
              self.packages.${system}.mintlify-openapi
            ];

            shellHook = ''
              export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
              export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            '';
          };

          skopeo = pkgs.mkShell {
            buildInputs = with pkgs;[
              skopeo
            ];
          };

          vercel = pkgs.mkShell {
            buildInputs = with pkgs;[
              nodePackages.vercel
            ];
          };

          codegen = codegenf.devShell;
          dashboard = dashboardf.devShell;
          docs = docsf.devShell;
          mintlify-openapi = mintlify-openapif.devShell;
          nhost-js = nhost-jsf.devShell;
          nixops = nixopsf.devShell;
        };

        packages = flake-utils.lib.flattenTree {
          dashboard = dashboardf.package;
          dashboard-docker-image = dashboardf.dockerImage;
          codegen = codegenf.package;
          mintlify-openapi = mintlify-openapif.package;
          nhost-js = nhost-jsf.package;
          nixops = nixopsf.package;
        };
      }
    );
}
