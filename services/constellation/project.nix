{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "constellation";
  description = "Nhost GraphQL Engine";
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
      ../../internal/lib/oapi
      (fs.fileFilter (f: f.hasExt "go") ./.)
      ../../internal/lib/oapi
      # oapi-codegen inputs consumed by `go generate` in the hermetic build.
      ./api/openapi.yaml
      ./api/server.cfg.yaml
      ./api/types.cfg.yaml
      ./connector/testdata
      ./connector/sql/postgres/testdata
      ./connector/sql/sqlite/testdata
      ./connector/sql/graphql/queries/testdata
      ./connector/sql/graphql/schema/testdata
      ./metadata/internal/hasura/testdata
      ./integration/nhost
    ];
  };

  tags = [ ];
  ldflags = [
    "-X main.Version=${version}"
  ];

  checkDeps = with pkgs; [
    nhost.nhost-cli
    mockgen
    nhost.oapi-codegen
    nhost.sqlc
    nhost.postgresql_18-client
  ];

  buildInputs = [ ];

  nativeBuildInputs = pkgs.lib.optionals pkgs.stdenv.isDarwin [
    pkgs.apple-sdk_14
  ];
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

    preCheck = ''
      export GOEXPERIMENT=jsonv2;
    '';
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

    shellHook = "export GOEXPERIMENT=jsonv2";
  };

  package =
    (nixops-lib.go.package {
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
    }).overrideAttrs
      (old: {
        env = (old.env or { }) // {
          GOEXPERIMENT = "jsonv2";
        };
      });

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
