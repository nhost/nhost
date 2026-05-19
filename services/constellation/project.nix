{
  self,
  pkgs,
  nix-filter,
  nixops-lib,
}:
let
  name = "constellation";
  description = "Nhost GraphQL Engine";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "services/${name}";

  src = nix-filter.lib.filter {
    root = ../..;
    include = with nix-filter.lib; [
      "go.mod"
      "go.sum"
      (inDirectory "vendor")
      ".golangci.yaml"
      "govulncheck.yaml"
      isDirectory
      (and (inDirectory submodule) (matchExt "go"))
    ];
  };

  tags = [ ];
  ldflags = [
    "-X main.Version=${version}"
  ];

  checkDeps = with pkgs; [
    nhost-cli
    mockgen
    oapi-codegen
    sqlc
    postgresql_18-client
  ];

  buildInputs = [ ];

  nativeBuildInputs = [ ];
in
rec {
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
    buildInputs =
      with pkgs;
      [
        skopeo
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

  dockerImage = nixops-lib.go.docker-image {
    inherit
      name
      package
      created
      version
      buildInputs
      ;

    contents = with pkgs; [
      wget # do not remove, useful for docker healthchecks
    ];
  };
}
