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
    nhost.gqlgen
    nhost.gqlgenc
    nhost.oapi-codegen
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
        nhost.certbot-full
        python312Packages.certbot-dns-route53

        nhost.gqlgen

        # javascript
        nhost.nodejs
        nhost.pnpm
        nhost.biome
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

  # Publishable npm tree: one main package that resolves a per-platform
  # binary package at runtime (esbuild-style optionalDependencies). Versions
  # are stamped from ${version} so the package metadata and the version baked
  # into the binary stay in lockstep, leaving the workflow to only publish.
  cli-npm =
    pkgs.runCommand "cli-npm-${version}"
      {
        nativeBuildInputs = [ pkgs.jq ];
        meta = {
          description = "npm packages (main + platform binaries) for ${description}";
        };
      }
      ''
        # key = npm package suffix (process.platform-process.arch);
        # os/goarch = cli-multiplatform layout (Go's GOOS/GOARCH).
        stage_platform() {
          dir="$out/dist/$1"
          mkdir -p "$dir"
          jq --arg v "${version}" '.version = $v' \
            ${./npm/platforms}/"$1"/package.json > "$dir/package.json"
          cp ${cli-multiplatform}/"$2"/"$3"/cli "$dir/nhost"
          chmod +x "$dir/nhost"
        }

        stage_platform darwin-arm64 darwin arm64
        stage_platform darwin-x64   darwin amd64
        stage_platform linux-arm64  linux  arm64
        stage_platform linux-x64    linux  amd64

        main="$out/dist/main"
        mkdir -p "$main/bin"
        jq --arg v "${version}" \
          '.version = $v | .optionalDependencies |= map_values($v)' \
          ${./npm/package.json} > "$main/package.json"
        cp ${./npm/bin/nhost} "$main/bin/nhost"
        chmod +x "$main/bin/nhost"
        cp ${./npm/README.md} "$main/README.md"
      '';
}
