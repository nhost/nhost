{
  pkgs,
  nixops-lib,
}:
let
  name = "graphql";
  submodule = "lib/${name}";
  description = "Common graphql functionality";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";

  fs = pkgs.lib.fileset;

  # source files needed for the build
  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      (fs.fileFilter (f: f.hasExt "go") ../../lib)
    ];
  };

  checkDeps = with pkgs; [
    sqlc
    mockgen
    nhost-cli
  ];

  buildInputs = with pkgs; [
  ];

  nativeBuildInputs = with pkgs; [
  ];

  tags = [ ];

  ldflags = [
  ];
in
rec {
  inherit name description version;

  check = nixops-lib.go.check {
    inherit
      src
      submodule
      ldflags
      tags
      checkDeps
      buildInputs
      nativeBuildInputs
      ;
  };

  devShell = nixops-lib.go.devShell {
    buildInputs =
      with pkgs;
      [
      ]
      ++ checkDeps
      ++ buildInputs
      ++ nativeBuildInputs;
  };

  package = nixops-lib.go.package {
    inherit
      name
      description
      version
      src
      submodule
      ldflags
      buildInputs
      nativeBuildInputs
      ;
  };
}
