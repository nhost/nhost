{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "jsontmpl";
  version = "0.0.0-dev";
  submodule = "internal/lib/${name}";

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ../../..;
    fileset = fs.unions [
      ../../../go.mod
      ../../../go.sum
      ../../../vendor
      ../../../.golangci.yaml
      (fs.fileFilter (f: f.hasExt "go") ./.)

      # Conformance and derived fixtures are read from disk by the tests, so
      # they must be part of the hermetic source.
      ./testdata
    ];
  };

  tags = [ ];
  ldflags = [ ];

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

    preCheck = ''
      export GOEXPERIMENT=jsonv2;
    '';
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = [
    ]
    ++ checkDeps
    ++ buildInputs
    ++ nativeBuildInputs;

    shellHook = "export GOEXPERIMENT=jsonv2";
  };
}
