{ self, pkgs, nix-filter, nixops-lib }:
let
  name = "codegen";
  description = "Codegen";
  version = "0.0.0-dev";
  submodule = "tools/${name}";

  src = nix-filter.lib.filter {
    root = ../..;
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
      (and
        (inDirectory submodule)
        (matchExt "tmpl")
      )
      (inDirectory "${submodule}/processor/testdata")
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
    inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = [
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  package = nixops-lib.go.package {
    inherit name description version src submodule ldflags buildInputs nativeBuildInputs;
  };
}
