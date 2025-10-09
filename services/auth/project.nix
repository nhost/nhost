{ self, pkgs, nix-filter, nixops-lib }:
let
  name = "auth";
  description = "Nhost Auth";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "services/${name}";

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

      ./docs/cli.md
      ./docs/openapi.yaml
      ./vacuum.yaml

      ./go/api/server.cfg.yaml
      ./go/api/types.cfg.yaml
      ./go/sql/schema.sh
      ./go/sql/sqlc.yaml
      ./go/sql/query.sql
      ./go/sql/auth_schema_dump.sql
      isDirectory
      (inDirectory ./go/migrations/postgres)
      (inDirectory ./email-templates)
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
    postgresql_17_5-client
    vacuum-go
  ];

  buildInputs = [ ];

  nativeBuildInputs = [ ];
in
rec {
  check = nixops-lib.go.check {
    inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;

    preCheck = ''
      echo "➜ Checking OpenAPI spec..."
      vacuum lint \
        -dqb -n info \
        --ruleset ${src}/${submodule}/vacuum.yaml \
        ${src}/${submodule}/docs/openapi.yaml
    '';
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = with pkgs; [
      go-migrate
      skopeo
      bun
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  package = nixops-lib.go.package {
    inherit name description version src submodule ldflags buildInputs nativeBuildInputs;

    postInstall = ''
      mkdir $out/share
      cp -rv ${src}/${submodule}/email-templates $out/share/email-templates
    '';
  };

  dockerImage = nixops-lib.go.docker-image {
    inherit name package created version buildInputs;
  };
}
