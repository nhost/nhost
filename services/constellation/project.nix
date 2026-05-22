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
      (inDirectory "${submodule}/connector/testdata")
      (inDirectory "${submodule}/connector/sql/postgres/testdata")
      (inDirectory "${submodule}/connector/sql/sqlite/testdata")
      (inDirectory "${submodule}/connector/sql/graphql/queries/testdata")
      (inDirectory "${submodule}/connector/sql/graphql/schema/testdata")
      (inDirectory "${submodule}/metadata/internal/hasura/testdata")
      (inDirectory "${submodule}/integration/nhost")
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
