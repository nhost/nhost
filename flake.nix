{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-filter.url = "github:numtide/nix-filter";
    nix2container.url = "github:nlewo/nix2container";
    nix2container.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, flake-utils, nix-filter, nix2container }:
    {
      #nixops
      lib = import ./nixops/lib/lib.nix;
      overlays.default = import ./nixops/overlays/default.nix;
    } // flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            (import ./nixops/overlays/default.nix)
          ];
        };

        nix2containerPkgs = nix2container.packages.${system};
        nixops-lib = (import ./nixops/lib/lib.nix) { inherit pkgs nix2containerPkgs; };

        authf = import ./services/auth/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };

        clif = import ./cli/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };

        codegenf = import ./tools/codegen/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };

        dashboardf = import ./dashboard/project.nix {
          inherit self pkgs nix-filter nixops-lib nix2containerPkgs;
        };

        demosf = import ./examples/demos/project.nix {
          inherit self pkgs nix-filter nixops-lib nix2containerPkgs;
        };

        docsf = import ./docs/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };

        guidesf = import ./examples/guides/project.nix {
          inherit self pkgs nix-filter nixops-lib nix2containerPkgs;
        };

        mintlify-openapif = import ./tools/mintlify-openapi/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };

        nhost-jsf = import ./packages/nhost-js/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };

        nixopsf = import ./nixops/project.nix {
          inherit self pkgs nix2containerPkgs nix-filter nixops-lib;
        };

        storagef = import ./services/storage/project.nix {
          inherit self pkgs nix-filter nixops-lib;
        };

        tutorialsf = import ./examples/tutorials/project.nix {
          inherit self pkgs nix-filter nixops-lib nix2containerPkgs;
        };

      in
      {
        checks = {
          auth = authf.check;
          cli = clif.check;
          codegen = codegenf.check;
          dashboard = dashboardf.check;
          demos = demosf.check;
          guides = guidesf.check;
          docs = docsf.check;
          mintlify-openapi = mintlify-openapif.check;
          nhost-js = nhost-jsf.check;
          nixops = nixopsf.check;
          storage = storagef.check;
          tutorials = tutorialsf.check;
        };

        devShells = flake-utils.lib.flattenTree {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              # general
              gh
              git-cliff
              gnused
              skopeo

              # cli
              certbot-full
              python312Packages.certbot-dns-route53

              nhost-cli

              # dashboard
              nodePackages.vercel
              playwright-driver

              # javascript
              nodejs
              pnpm
              biome

              # go
              go
              golines
              gofumpt
              golangci-lint
              gqlgenc
              oapi-codegen

              # docs
              mintlify

              # internal packages
              self.packages.${system}.codegen
              self.packages.${system}.mintlify-openapi
            ];

            shellHook = ''
              export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
              export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            '';
          };

          cliff = pkgs.mkShell {
            buildInputs = with pkgs; [
              git-cliff
            ];
          };

          pnpm = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs
              pnpm
            ];
          };

          skopeo = pkgs.mkShell {
            buildInputs = with pkgs;[
              skopeo
            ];
          };

          vercel = pkgs.mkShell {
            buildInputs = with pkgs;[
              pnpm
              nodejs
              nodePackages.vercel
            ];
          };

          auth = authf.devShell;
          cli = clif.devShell;
          codegen = codegenf.devShell;
          dashboard = dashboardf.devShell;
          demos = demosf.devShell;
          guides = guidesf.devShell;
          docs = docsf.devShell;
          mintlify-openapi = mintlify-openapif.devShell;
          nhost-js = nhost-jsf.devShell;
          nixops = nixopsf.devShell;
          storage = storagef.devShell;
          tutorials = tutorialsf.devShell;
        };

        packages = flake-utils.lib.flattenTree {
          auth = authf.package;
          auth-docker-image = authf.dockerImage;
          cli = clif.package;
          cli-multiplatform = clif.cli-multiplatform;
          cli-docker-image = clif.dockerImage;
          codegen = codegenf.package;
          dashboard = dashboardf.package;
          dashboard-docker-image = dashboardf.dockerImage;
          demos = demosf.package;
          guides = guidesf.package;
          mintlify-openapi = mintlify-openapif.package;
          nhost-js = nhost-jsf.package;
          nixops = nixopsf.package;
          nixops-docker-image = nixopsf.dockerImage;
          storage = storagef.package;
          storage-docker-image = storagef.dockerImage;
          clamav-docker-image = storagef.clamav-docker-image;
          tutorials = tutorialsf.package;
        };
      }
    );
}
