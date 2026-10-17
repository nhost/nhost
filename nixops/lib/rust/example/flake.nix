{
  inputs = {
    nixops.url = "./../../../../";
    nixpkgs.follows = "nixops/nixpkgs";
    flake-utils.follows = "nixops/flake-utils";
    nix2container.follows = "nixops/nix2container";
  };

  outputs =
    {
      self,
      nixops,
      nixpkgs,
      flake-utils,
      nix2container,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        overlays = [ nixops.overlays.default ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };
        nix2containerPkgs = nix2container.packages.${system};

        nixops-lib = nixops.lib { inherit pkgs nix2containerPkgs; };

        src = pkgs.lib.fileset.toSource {
          root = ./.;
          fileset = pkgs.lib.fileset.unions [
            ./Cargo.toml
            ./Cargo.lock
            ./deny.toml
            ./src
          ];
        };

        buildInputs = with pkgs; [ ];
        nativeBuildInputs = with pkgs; [ ];
        checkDeps = with pkgs; [ ];
      in
      {
        checks = {
          rust-checks = nixops-lib.rust.check {
            inherit
              src
              buildInputs
              nativeBuildInputs
              checkDeps
              ;

            cargoLock = ./Cargo.lock;
            denyConfig = ./deny.toml;
          };
        };

        devShells = flake-utils.lib.flattenTree rec {
          default = nixops-lib.rust.devShell {
            buildInputs = with pkgs; [ ];
          };
        };
      }
    );
}
