{ self, pkgs, nix-filter, nixops-lib }:
let
  name = "nhostclient";
  version = "0.0.0-dev";
  submodule = "internal/lib/${name}";

  src = nix-filter.lib.filter {
    root = ../../..;
    include = with nix-filter.lib;[
      "go.mod"
      "go.sum"
      (inDirectory "vendor")
      ".golangci.yaml"
      isDirectory
      (and
        (inDirectory submodule)
        (matchExt "go")
      )

      # OpenAPI specs needed for code generation
      ../../../services/auth/docs/openapi.yaml
      ../../../services/storage/controller/openapi.yaml
    ];
  };

  tags = [ ];
  ldflags = [ ];

  checkDeps = with pkgs; [
    oapi-codegen
  ];

  buildInputs = [ ];

  nativeBuildInputs = [ ];
in
{
  check = nixops-lib.go.check {
    inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = [
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };
}
