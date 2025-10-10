{ self, pkgs, nix-filter, nixops-lib }:
let
  name = "nixops";
  version = "0.0.0-dev";
  submodule = "${name}";

  src = nix-filter.lib.filter {
    root = ../.;
    include = with nix-filter.lib; [
      "./flake.lock"
      "./flake.nix"
      (and
        (inDirectory submodule)
        isDirectory
      )
      (and
        (inDirectory submodule)
        (matchExt "nix")
      )
    ];
  };

  checkDeps = [ ];

  # we use this to just build and cache the packages
  buildInputs = with pkgs; [
    biome
    go
    golangci-lint
    mockgen
    golines
    govulncheck
    gqlgen
    gqlgenc
    oapi-codegen
    nhost-cli
    skopeo
    postgresql_16_10-client
    postgresql_17_6-client
    postgresql_18_0-client
    postgresql_16_10
    postgresql_17_6
    postgresql_18_0
  ];

  nativeBuildInputs = [ ];
in
{
  check = nixops-lib.nix.check { inherit src; };

  devShell = pkgs.mkShell {
    buildInputs = checkDeps ++ buildInputs ++ nativeBuildInputs;
  };


  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = nativeBuildInputs;
    buildInputs = buildInputs;

    installPhase = ''
      mkdir -p $out
      cp -r ${src} $out/
    '';
  };
}

