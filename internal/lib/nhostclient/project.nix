{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhostclient";
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
      ../../../govulncheck.yaml
      (fs.fileFilter (f: f.hasExt "go") ./.)

      # OpenAPI specs needed for code generation
      ../../../services/auth/docs/openapi.yaml
      ../../../services/storage/controller/openapi.yaml
    ];
  };

  tags = [ ];
  ldflags = [ ];

  checkDeps = with pkgs; [
    nhost.oapi-codegen
  ];

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
}
