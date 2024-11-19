{ pkgs, nix-filter, nixops-lib }:
let
  name = "graphql";
  submodule = "lib/${name}";
  description = "Common graphql functionality";
  version = pkgs.lib.fileContents ./VERSION;

  # source files needed for the build
  src = nix-filter.lib.filter {
    root = ../..;
    include = with nix-filter.lib;[
      ".golangci.yaml"
      "go.mod"
      "go.sum"
      (inDirectory "vendor")
      isDirectory
      "${submodule}/directive/sql/sqlc.yaml"
      "${submodule}/directive/sql/query.sql"
      "services/console-next/schema.sql"
      (and
        (inDirectory submodule)
        (matchExt "go")
      )
      (and
        (inDirectory "lib/consoleNextClient")
        (matchExt "go")
      )
      (and
        (inDirectory "lib/tracing")
        (matchExt "go")
      )
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
rec{
  inherit name description version;

  check = nixops-lib.go.check {
    inherit src submodule ldflags tags checkDeps buildInputs nativeBuildInputs;
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = with pkgs; [
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  package = nixops-lib.go.package {
    inherit name description version src submodule ldflags buildInputs nativeBuildInputs;
  };
}
