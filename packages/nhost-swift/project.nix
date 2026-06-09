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

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ./CLAUDE.md
      ./Package.swift
      ./README.md
      ./Sources
      ./Tests
    ];
  };

  checkDeps = [ ];

  buildInputs = [ ];
  nativeBuildInputs = [ ];
in
{
  devShell = nixops-lib.swift.devShell {
    inherit
      buildInputs
      checkDeps
      nativeBuildInputs
      ;
  };

  check = nixops-lib.swift.check {
    inherit
      src
      buildInputs
      checkDeps
      nativeBuildInputs
      ;
    packagePath = submodule;
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
