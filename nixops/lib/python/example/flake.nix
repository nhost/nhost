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
            ./app.py
            ./test_app.py
            ./mypy.ini
            ./requirements.txt
          ];
        };

        buildInputs = with pkgs; [ ];
        nativeBuildInputs = with pkgs; [ ];
        checkDeps = with pkgs; [ ];
      in
      {
        checks = {
          python-checks = nixops-lib.python.check {
            inherit
              src
              buildInputs
              nativeBuildInputs
              checkDeps
              ;

            lintPaths = "app.py test_app.py";
            typecheckPaths = "app.py";
            testPaths = "test_app.py";
            auditLockfile = "requirements.txt";
          };
        };

        devShells = flake-utils.lib.flattenTree rec {
          default = nixops-lib.python.devShell {
            buildInputs = with pkgs; [ ];
          };
        };
      }
    );
}
