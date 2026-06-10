{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "cli";
  description = "Nhost CLI";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "${name}";

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ./..;
    fileset = fs.unions [
      ../go.mod
      ../go.sum
      ../vendor
      ../.golangci.yaml
      ../govulncheck.yaml
      (fs.fileFilter (f: f.hasExt "go") ./.)
      ./get_access_token.sh
      ./gqlgenc.yaml
      ./ssl/.ssl
      ./cmd/config/testdata
      ./cmd/project/templates
      ./nhostclient/graphql/query

      (fs.fileFilter (f: f.hasExt "go") ../internal/lib/clidocs)

      (fs.fileFilter (f: f.hasExt "go") ../internal/lib/nhostclient)

      (fs.fileFilter (f: f.hasExt "go") ../internal/lib/oapi)

      ./cmd/configserver/logsapi/gqlgen.yml
      ./cmd/configserver/logsapi/schema.graphqls

      ./mcp/nhost/graphql/openapi.yaml
      ./mcp/resources/cloud_schema.graphql
      ./mcp/resources/cloud_schema-with-mutations.graphql
      ./mcp/resources/nhost_toml_schema.cue
      ./cmd/mcp/testdata
      ./mcp/graphql/testdata

      # constellation (used by `nhost schema` for SDL dump/diff)
      (fs.fileFilter (f: f.hasExt "go") ../services/constellation)

      # auth email templates (embedded into the CLI binary by `nhost init`)
      ../services/auth/email-templates

      # docs
      ../docs/embed.go
      (fs.fileFilter (f: f.hasExt "mdx") ../docs/src/content/docs)
    ];
  };

  tags = [ ];
  ldflags = [
    "-X main.Version=${version}"
  ];

  checkDeps = with pkgs; [
    jq
    curl
    cacert
    gqlgen
    gqlgenc
    oapi-codegen
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

    impureEnvVars = {
      NHOST_PAT = builtins.getEnv "NHOST_PAT";
    };

    preCheck = ''
      export GOEXPERIMENT=jsonv2;

      if [ -z "''${NHOST_PAT:-}" ]; then
        echo "ERROR: NHOST_PAT environment variable is not set"
        exit 1
      fi

      echo "➜ Getting access token"
      export NHOST_ACCESS_TOKEN=$(bash ${src}/cli/get_access_token.sh)
    '';
  };

  devShell = nixops-lib.go.devShell {
    buildInputs =
      with pkgs;
      [
        certbot-full
        python312Packages.certbot-dns-route53

        gqlgen

        # javascript
        nodejs-pinned
        pnpm
        biome
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
      (
        old:
        old
        // {
          env = {
            CGO_ENABLED = "0";
            GOEXPERIMENT = "jsonv2";
          };
        }
      );

  dockerImage = nixops-lib.go.docker-image {
    inherit
      name
      package
      created
      version
      buildInputs
      ;
  };

  cli-arm64-darwin =
    (nixops-lib.go.package {
      inherit
        name
        submodule
        description
        src
        version
        ldflags
        buildInputs
        nativeBuildInputs
        ;
    }).overrideAttrs
      (
        old:
        old
        // {
          env = {
            GOOS = "darwin";
            GOARCH = "arm64";
            CGO_ENABLED = "0";
            GOEXPERIMENT = "jsonv2";
          };
        }
      );

  cli-amd64-darwin =
    (nixops-lib.go.package {
      inherit
        name
        submodule
        description
        src
        version
        ldflags
        buildInputs
        nativeBuildInputs
        ;
    }).overrideAttrs
      (
        old:
        old
        // {
          env = {
            GOOS = "darwin";
            GOARCH = "amd64";
            CGO_ENABLED = "0";
            GOEXPERIMENT = "jsonv2";
          };
        }
      );

  cli-arm64-linux =
    (nixops-lib.go.package {
      inherit
        name
        submodule
        description
        src
        version
        ldflags
        buildInputs
        nativeBuildInputs
        ;
    }).overrideAttrs
      (
        old:
        old
        // {
          env = {
            GOOS = "linux";
            GOARCH = "arm64";
            CGO_ENABLED = "0";
            GOEXPERIMENT = "jsonv2";
          };
        }
      );

  cli-amd64-linux =
    (nixops-lib.go.package {
      inherit
        name
        submodule
        description
        src
        version
        ldflags
        buildInputs
        nativeBuildInputs
        ;
    }).overrideAttrs
      (
        old:
        old
        // {
          env = {
            GOOS = "linux";
            GOARCH = "amd64";
            CGO_ENABLED = "0";
            GOEXPERIMENT = "jsonv2";
          };
        }
      );

  cli-multiplatform =
    pkgs.runCommand "cli-multiplatform-${version}"
      {
        meta = {
          description = "Multi-platform ${description} binaries";
        };
      }
      ''
        mkdir -p $out/{darwin,linux}/{arm64,amd64}

        cp ${cli-arm64-darwin}/bin/${name} $out/darwin/arm64/cli
        cp ${cli-amd64-darwin}/bin/${name} $out/darwin/amd64/cli
        cp ${cli-arm64-linux}/bin/${name} $out/linux/arm64/cli
        cp ${cli-amd64-linux}/bin/${name} $out/linux/amd64/cli
      '';
}
