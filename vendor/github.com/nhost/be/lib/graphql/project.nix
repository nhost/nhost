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

  # source files needed for the build
  src =
    let
      fs = pkgs.lib.fileset;
    in
    fs.toSource {
      root = ../..;
      fileset = fs.unions [
        ../../.golangci.yaml
        ../../govulncheck.yaml
        ../../go.mod
        ../../go.sum
        (fs.fileFilter (file: file.hasExt "go") ../../lib)
        ../../vendor
        ../../${submodule}/directive/sql/sqlc.yaml
        ../../${submodule}/directive/sql/query.sql
        ../../services/console-next/schema.sql
        (fs.fileFilter (file: file.hasExt "go") ../../${submodule})
      ];
    };

  checkDeps = with pkgs; [
    nhost.sqlc
    mockgen
    nhost.nhost-cli
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
