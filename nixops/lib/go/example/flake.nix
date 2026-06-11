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
            (pkgs.lib.fileset.fileFilter (f: f.hasExt "go") ./.)
            ./go.mod
          ];
        };

        name = "example";
        description = "nixops example for go";
        version = "0.0.0-dev";
        created = "1970-01-01T00:00:00Z";
        module = "github.com/nhost/nixops/lib/go/example";
        tags = [ "integration" ];
        ldflags = [
          "-X main.Version=${version}"
        ];
        buildInputs = with pkgs; [ ];
        nativeBuildInputs = with pkgs; [ ];
        checkDeps = with pkgs; [ ];
      in
      {
        checks = {
          go-checks = nixops-lib.go.check {
            inherit
              src
              ldflags
              tags
              buildInputs
              nativeBuildInputs
              checkDeps
              ;
          };
        };

        devShells = flake-utils.lib.flattenTree rec {
          default = nixops-lib.go.devShell {
            buildInputs = with pkgs; [
              mockgen
              nhost.gqlgen
              nhost.gqlgenc
              nhost.oapi-codegen
              skopeo
            ];
          };
        };

        packages = flake-utils.lib.flattenTree rec {
          example = nixops-lib.go.package {
            inherit
              name
              src
              version
              ldflags
              buildInputs
              nativeBuildInputs
              ;
          };

          # example-arm64-darwin = (nixops-lib.go.package {
          #   inherit name src version ldflags buildInputs nativeBuildInputs;
          # }).overrideAttrs (old: old // { GOOS = "darwin"; GOARCH = "arm64"; CGO_ENABLED = "0"; });

          # example-amd64-darwin = (nixops-lib.go.package {
          #   inherit name src version ldflags buildInputs nativeBuildInputs;
          # }).overrideAttrs (old: old // { GOOS = "darwin"; GOARCH = "amd64"; GO_ENABLED = "0"; });

          # example-arm64-linux = (nixops-lib.go.package {
          #   inherit name src version ldflags buildInputs nativeBuildInputs;
          # }).overrideAttrs (old: old // { GOOS = "linux"; GOARCH = "arm64"; CGO_ENABLED = "0"; });

          # example-amd64-linux = (nixops-lib.go.package {
          #   inherit name src version ldflags buildInputs nativeBuildInputs;
          # }).overrideAttrs (old: old // { GOOS = "linux"; GOARCH = "amd64"; CGO_ENABLED = "0"; });

          docker-image = nixops-lib.generic.docker-image {
            inherit name created;
            tag = version;

          };

          default = example;
        };

      }
    );
}
