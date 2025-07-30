{ pkgs, nix-filter, nixops-lib }:
let
  name = "graphql";
  submodule = "lib/${name}";
  description = "Common graphql functionality";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";

  # source files needed for the build
  src = nix-filter.lib.filter {
    root = ../..;
    include = with nix-filter.lib;[
      ".golangci.yaml"
      "go.mod"
      "go.sum"
      (and
        (inDirectory "lib")
        (matchExt "go")
      )
      (inDirectory "vendor")
      isDirectory
      "${submodule}/directive/sql/sqlc.yaml"
      "${submodule}/directive/sql/query.sql"
      "services/console-next/schema.sql"
      (and
        (inDirectory submodule)
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
