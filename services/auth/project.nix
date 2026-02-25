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
      ./vacuum-ignore.yaml

      (inDirectory ../../internal/lib/oapi)
      (inDirectory ../../internal/lib/hasura/metadata)

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

  node-src = nix-filter.lib.filter {
    root = ./.;
    include = with nix-filter.lib;[
      ./package.json
      ./bun.lock
      ./bunfig.toml
      ./tsconfig.json
      ./.env.example
      (inDirectory "test")
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
    postgresql_18_1-client
    vacuum-go
    bun
  ];

  buildInputs = [ ];

  nativeBuildInputs = [ ];

  node_modules-builder = pkgs.stdenv.mkDerivation {
    inherit version;

    pname = "node_modules-builder";

    nativeBuildInputs = with pkgs; [
      bun
      cacert
    ];

    src = nix-filter.lib.filter {
      root = ../..;
      include = [
        ./package.json
        ./bun.lock
        ./bunfig.toml
      ];
    };

    buildPhase = ''
      export HOME=$TMPDIR
      mkdir -p packages
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js
      cd ${submodule}
      bun install --frozen-lockfile
      rm -rf node_modules/.cache
      rm -rf node_modules/@nhost/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js} node_modules/@nhost/nhost-js
    '';

    installPhase = ''
      mkdir -p $out
      cp -r node_modules $out
    '';
  };
in
rec {
  check = nixops-lib.go.check {
    inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;

    preCheck = ''
      echo "➜ Checking OpenAPI spec..."
      vacuum lint \
        -dqb -n info \
        --ignore-file ${src}/${submodule}/vacuum-ignore.yaml \
        --ruleset ${src}/${submodule}/vacuum.yaml \
        ${src}/${submodule}/docs/openapi.yaml
      echo ""
    '';

    extraCheck = ''
      echo "➜ Running e2e tests..."
      mkdir -p $TMPDIR/auth
      cd $TMPDIR/auth
      cp -r ${node-src}/* .
      cp -r ${node-src}/.* .
      ln -s ${node_modules-builder}/node_modules node_modules

      bun test --env-file .env.example
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

    contents = with pkgs; [
      wget # do not remove, useful for docker healthchecks
    ];
  };
}
