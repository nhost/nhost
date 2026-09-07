{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "ai";
  description = "Nhost AI";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "services/${name}";

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../go.mod
      ../../go.sum
      ../../vendor
      ../../.golangci.yaml
      ../../govulncheck.yaml
      (fs.fileFilter (f: f.hasExt "go") ./.)
      ./gqlgenc.yml
      ./hasura/client.graphqls
      ./migrations/postgres
    ];
  };

  tags = [ "integration" ];
  ldflags = [
    "-X main.Version=${version}"
  ];

  checkDeps = with pkgs; [
    nhost.nhost-cli
    nhost.gqlgenc
    mockgen
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
        go-migrate
        nhost.postgresql_18-client
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
  };
}
