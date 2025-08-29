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
    postgresql_14_18-client
    postgresql_15_13-client
    postgresql_16_9-client
    postgresql_17_5-client
    postgresql_14_18
    postgresql_15_13
    postgresql_16_9
    postgresql_17_5
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

