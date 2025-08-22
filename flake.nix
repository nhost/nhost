{
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

        nix2containerPkgs = nix2container.packages.${system};
        nixops-lib = nixops.lib { inherit pkgs nix2containerPkgs; };

        nodeModulesLib = import ./nix/node_modules.nix { inherit pkgs nix-filter; };
        inherit (nodeModulesLib) node_modules mkNodeDevShell;

        dashboardf = import ./dashboard/project.nix {
          inherit self pkgs nix2containerPkgs nix-filter nixops-lib mkNodeDevShell node_modules;
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

          dashboard = dashboardf.check;
        };

        devShells = flake-utils.lib.flattenTree {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              playwright-test
              nhost-cli
              nodejs
              pnpm_10
              go
              golangci-lint
              skopeo
            ];
          };

          skopeo = pkgs.mkShell {
            buildInputs = with pkgs;[
              skopeo
            ];
          };

          dashboard = dashboardf.devShell;
        };

        packages = flake-utils.lib.flattenTree {
          dashboard = dashboardf.package;
          dashboard-docker-image = dashboardf.dockerImage;
        };
      }
    );
}
