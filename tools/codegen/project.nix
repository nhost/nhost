{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "codegen";
  description = "Codegen";
  version = "0.0.0-dev";
  submodule = "tools/${name}";

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../go.mod
      ../../go.sum
      ../../vendor
      ../../.golangci.yaml
      (fs.fileFilter (f: f.hasExt "go") ./.)
      (fs.fileFilter (f: f.hasExt "tmpl") ./.)
      ./processor/testdata
    ];
  };

  tags = [ ];
  ldflags = [
    "-X main.Version=${version}"
  ];

  checkDeps = [ ];

  buildInputs = [ ];

  nativeBuildInputs = [ ];
in
{
  check = nixops-lib.go.check {
    inherit
      src
      submodule
      ldflags
      tags
      buildInputs
      nativeBuildInputs
      checkDeps
      ;
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = [
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
