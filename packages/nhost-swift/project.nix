{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-swift";
  version = "0.0.0-dev";
  submodule = "packages/${name}";

  fs = pkgs.lib.fileset;

  srcFileset = fs.unions [
    ./CLAUDE.md
    ./gen.sh
    ./Package.swift
    ./README.md
    ./Sources
    ./Tests
    ../../services/auth/docs/openapi.yaml
    ../../services/storage/controller/openapi.yaml
  ];

  src = fs.toSource {
    root = ../..;
    fileset = srcFileset;
  };

  checkSrc = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      srcFileset
      ./build/backend
      ./dev-env.sh
    ];
  };

  checkDeps = [
    self.packages.${pkgs.stdenv.hostPlatform.system}.codegen
  ];

  devEnvDeps = with pkgs; [
    nhost-cli
  ];

  buildInputs = [ ];
  nativeBuildInputs = [ ];
in
{
  devShell = nixops-lib.swift.devShell {
    inherit
      buildInputs
      nativeBuildInputs
      ;
    checkDeps = checkDeps ++ devEnvDeps;
  };

  check = nixops-lib.swift.check {
    inherit
      buildInputs
      checkDeps
      nativeBuildInputs
      ;
    src = checkSrc;
    packagePath = submodule;
    preCheck = ''
      echo "➜ Checking generated Auth and Storage clients"
      committed_generated=$(mktemp -d)
      cp -R Sources/Nhost/Generated "$committed_generated/Generated"

      ./gen.sh
      diff -ru "$committed_generated/Generated" Sources/Nhost/Generated
    '';
  };

  package = nixops-lib.swift.package {
    inherit
      name
      version
      src
      buildInputs
      nativeBuildInputs
      ;
    packagePath = submodule;
  };
}
