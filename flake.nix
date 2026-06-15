{
  nixConfig = {
    sandbox = "relaxed";
    extra-substituters = [
      "s3://nhost-nix-cache?endpoint=https://14bc02755b64adb7c8c62b5420d0a457.eu.r2.cloudflarestorage.com&region=auto&profile=nhost-nix-cache"
      "https://cache.nixos.org"
    ];
    extra-trusted-public-keys = [
      "nhost-nix-cache:6bHlSIHLl5ubPXXS0EGgrvEQTyQnc+L05/6vShe/B6g="
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
    ];
  };

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix2container.url = "github:nlewo/nix2container";
    nix2container.inputs.nixpkgs.follows = "nixpkgs";
  };

  # asdasdasd
  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      nix2container,
    }:
    {
      #nixops
      lib = import ./nixops/lib/lib.nix;
      overlays.default = import ./nixops/overlays/default.nix;
    }
    // flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
          overlays = [
            (import ./nixops/overlays/default.nix)
          ];
        };

        nix2containerPkgs = nix2container.packages.${system};
        nixops-lib = (import ./nixops/lib/lib.nix) { inherit pkgs nix2containerPkgs; };

        authf = import ./services/auth/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        clif = import ./cli/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        codegenf = import ./tools/codegen/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        constellationf = import ./services/constellation/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        ghactivityf = import ./tools/ghactivity/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        govulncheck-wrapperf = import ./tools/govulncheck-wrapper/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        dashboardf = import ./dashboard/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            nix2containerPkgs
            ;
        };

        demosf = import ./examples/demos/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            nix2containerPkgs
            ;
        };

        functionsf = import ./services/functions/project.nix {
          inherit
            self
            pkgs
            nix2containerPkgs
            nixops-lib
            ;
        };

        docsf = import ./docs/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        guidesf = import ./examples/guides/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            nix2containerPkgs
            ;
        };

        mcpf = import ./services/mcp/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        nhost-jsf = import ./packages/nhost-js/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        stripe-graphql-jsf = import ./packages/stripe-graphql-js/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        nixopsf = import ./nixops/project.nix {
          inherit
            pkgs
            nix2containerPkgs
            nixops-lib
            ;
        };

        postgresf = import ./services/postgres/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            nix2containerPkgs
            ;
        };

        nhostclientf = import ./internal/lib/nhostclient/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        storagef = import ./services/storage/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            ;
        };

        tutorialsf = import ./examples/tutorials/project.nix {
          inherit
            self
            pkgs
            nixops-lib
            nix2containerPkgs
            ;
        };

      in
      {
        checks = {
          auth = authf.check;
          cli = clif.check;
          codegen = codegenf.check;
          constellation = constellationf.check;
          ghactivity = ghactivityf.check;
          govulncheck-wrapper = govulncheck-wrapperf.check;
          dashboard = dashboardf.check;
          demos = demosf.check;
          functions = functionsf.check;
          guides = guidesf.check;
          docs = docsf.check;
          mcp = mcpf.check;
          nhostclient = nhostclientf.check;
          nhost-js = nhost-jsf.check;
          stripe-graphql-js = stripe-graphql-jsf.check;
          nixops = nixopsf.check;
          postgres = postgresf.check;
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
              nhost.certbot-full
              python312Packages.certbot-dns-route53

              nhost.nhost-cli

              # dashboard
              nhost.vercel
              playwright-driver
              lychee

              # javascript
              nhost.nodejs
              nhost.pnpm
              nhost.biome

              # go
              nhost.go
              nhost.golines
              gofumpt
              nhost.golangci-lint
              nhost.gqlgen
              nhost.gqlgenc
              nhost.oapi-codegen
              mockgen
              nhost.sqlc
              vacuum-go
              nhost.govulncheck

              # others
              nhost.postgresql_18-client
              bun
              nhost.pi-agent

              # docs
              vale

              # nix
              nixfmt

              # storate
              clang
              pkg-config
              storagef.vips

              # internal packages
              self.packages.${system}.codegen
              self.packages.${system}.ghactivity
              self.packages.${system}.govulncheck-wrapper
            ];

            shellHook = ''
              export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
              export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true

              export GOEXPERIMENT=jsonv2
            '';
          };

          cliff = pkgs.mkShell {
            buildInputs = with pkgs; [
              git-cliff
            ];
          };

          pnpm = pkgs.mkShell {
            buildInputs = with pkgs; [
              nhost.nodejs
              nhost.pnpm
            ];
          };

          security-updates = pkgs.mkShell {
            buildInputs = with pkgs; [
              # pnpm audit --fix=update
              nhost.nodejs
              nhost.pnpm

              # govulncheck-wrapper -fix → go get / go mod tidy / go mod vendor
              nhost.go
              nhost.govulncheck
              self.packages.${system}.govulncheck-wrapper
            ];

            shellHook = ''
              export GOEXPERIMENT=jsonv2
            '';
          };

          skopeo = pkgs.mkShell {
            buildInputs = with pkgs; [
              skopeo
            ];
          };

          vercel = pkgs.mkShell {
            buildInputs = with pkgs; [
              nhost.pnpm
              nhost.nodejs
              nhost.vercel
            ];
          };

          auth = authf.devShell;
          cli = clif.devShell;
          codegen = codegenf.devShell;
          constellation = constellationf.devShell;
          ghactivity = ghactivityf.devShell;
          govulncheck-wrapper = govulncheck-wrapperf.devShell;
          dashboard = dashboardf.devShell;
          demos = demosf.devShell;
          guides = guidesf.devShell;
          docs = docsf.devShell;
          functions = functionsf.devShell;
          mcp = mcpf.devShell;
          nhostclient = nhostclientf.devShell;
          nhost-js = nhost-jsf.devShell;
          stripe-graphql-js = stripe-graphql-jsf.devShell;
          nixops = nixopsf.devShell;
          postgres = postgresf.devShell;
          storage = storagef.devShell;
          tutorials = tutorialsf.devShell;
        };

        packages = flake-utils.lib.flattenTree {
          auth = authf.package;
          auth-docker-image = authf.dockerImage;
          cli = clif.package;
          cli-multiplatform = clif.cli-multiplatform;
          cli-npm = clif.cli-npm;
          cli-docker-image = clif.dockerImage;
          codegen = codegenf.package;
          constellation = constellationf.package;
          constellation-docker-image = constellationf.dockerImage;
          ghactivity = ghactivityf.package;
          govulncheck-wrapper = govulncheck-wrapperf.package;
          dashboard = dashboardf.package;
          dashboard-docker-image = dashboardf.dockerImage;
          dashboard-e2e-staging-main = dashboardf.check-staging-main;
          dashboard-e2e-staging-onboarding = dashboardf.check-staging-onboarding;
          dashboard-e2e-staging-local = dashboardf.check-staging-local;
          dashboard-vercel-build-preview = dashboardf.vercelBuildPreview;
          dashboard-vercel-deploy-preview = dashboardf.vercelDeployPreview;
          dashboard-vercel-build-production = dashboardf.vercelBuildProduction;
          dashboard-vercel-deploy-production = dashboardf.vercelDeployProduction;
          demos = demosf.package;
          functions = functionsf.package;
          functions-node22-docker-image = functionsf.node22DockerImage;
          functions-node24-docker-image = functionsf.node24DockerImage;
          guides = guidesf.package;
          docs-vercel-build-preview = docsf.vercelBuildPreview;
          docs-vercel-deploy-preview = docsf.vercelDeployPreview;
          docs-vercel-build-production = docsf.vercelBuildProduction;
          docs-vercel-deploy-production = docsf.vercelDeployProduction;
          nhost-js = nhost-jsf.package;
          stripe-graphql-js = stripe-graphql-jsf.package;
          mcp = mcpf.package;
          mcp-docker-image = mcpf.dockerImage;
          nixops = nixopsf.package;
          nixops-docker-image = nixopsf.dockerImage;
          pi-agent = pkgs.nhost.pi-agent;
          postgres-pg16 = postgresf.packages.pg16-package;
          postgres-pg16-docker-image = postgresf.packages.pg16-docker-image;
          postgres-pg16-as-dir = postgresf.packages.pg16-as-dir;
          postgres-pg17 = postgresf.packages.pg17-package;
          postgres-pg17-docker-image = postgresf.packages.pg17-docker-image;
          postgres-pg17-as-dir = postgresf.packages.pg17-as-dir;
          postgres-pg18 = postgresf.packages.pg18-package;
          postgres-pg18-docker-image = postgresf.packages.pg18-docker-image;
          postgres-pg18-as-dir = postgresf.packages.pg18-as-dir;
          storage = storagef.package;
          storage-docker-image = storagef.dockerImage;
          storage-vips = storagef.vips;
          clamav-docker-image = storagef.clamav-docker-image;
          tutorials = tutorialsf.package;
        };
      }
    );
}
