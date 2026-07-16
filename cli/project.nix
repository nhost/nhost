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
      ../internal/lib/clidocs/testdata

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
        nhost.kubectl
        dnsutils
        shellcheck

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

  cli-npm =
    pkgs.runCommand "cli-npm-${version}"
      {
        nativeBuildInputs = [ pkgs.jq ];
        meta = {
          description = "npm packages (main + platform binaries) for ${description}";
        };
      }
      ''
        stage_platform() {
          dir="$out/$1"
          mkdir -p "$dir"
          jq --arg v "${version}" '.version = $v' \
            ${./build/npm/platforms}/"$1"/package.json > "$dir/package.json"
          cp ${cli-multiplatform}/"$2"/"$3"/cli "$dir/nhost"
          chmod +x "$dir/nhost"
        }

        stage_platform darwin-arm64 darwin arm64
        stage_platform darwin-x64   darwin amd64
        stage_platform linux-arm64  linux  arm64
        stage_platform linux-x64    linux  amd64

        main="$out/main"
        mkdir -p "$main/bin"
        jq --arg v "${version}" \
          '.version = $v | .optionalDependencies |= map_values($v)' \
          ${./build/npm/package.json} > "$main/package.json"
        cp ${./build/npm/bin/nhost} "$main/bin/nhost"
        chmod +x "$main/bin/nhost"
        cp ${./build/npm/README.md} "$main/README.md"

        validate_platform_metadata() {
          main_name=$(jq -r '.name' "$main/package.json")
          single_quote_prefix="const PKG_PREFIX = '$main_name';"
          double_quote_prefix="const PKG_PREFIX = \"$main_name\";"
          if ! grep -Fqx "$single_quote_prefix" "$main/bin/nhost" \
            && ! grep -Fqx "$double_quote_prefix" "$main/bin/nhost"; then
            echo "ERROR: cli npm shim PKG_PREFIX must match main package name '$main_name'" >&2
            exit 1
          fi

          if ! jq -e --arg v "${version}" '.version == $v' "$main/package.json" > /dev/null; then
            echo "ERROR: main npm package version must be ${version}" >&2
            exit 1
          fi

          if ! jq -e --arg v "${version}" \
            '(.optionalDependencies | type == "object") and (.optionalDependencies | all(.[]; . == $v))' \
            "$main/package.json" > /dev/null; then
            echo "ERROR: main npm optionalDependencies must all use version ${version}" >&2
            exit 1
          fi

          platform_names_file="$TMPDIR/cli-npm-platform-names"
          optional_dependency_names_file="$TMPDIR/cli-npm-optional-dependency-names"
          : > "$platform_names_file"

          for platform in darwin-arm64 darwin-x64 linux-arm64 linux-x64; do
            platform_package="$out/$platform/package.json"
            if ! jq -e --arg v "${version}" '.version == $v' "$platform_package" > /dev/null; then
              echo "ERROR: $platform npm package version must be ${version}" >&2
              exit 1
            fi

            platform_name=$(jq -r '.name' "$platform_package")
            case "$platform_name" in
              "$main_name"-*) ;;
              *)
                echo "ERROR: $platform package name '$platform_name' must use prefix '$main_name-'" >&2
                exit 1
                ;;
            esac
            echo "$platform_name" >> "$platform_names_file"
          done
          sort -o "$platform_names_file" "$platform_names_file"

          jq -r '.optionalDependencies | keys[]' "$main/package.json" > "$optional_dependency_names_file"
          sort -o "$optional_dependency_names_file" "$optional_dependency_names_file"

          if ! cmp -s "$optional_dependency_names_file" "$platform_names_file"; then
            echo "ERROR: main npm optionalDependencies must exactly match platform package names" >&2
            echo "optionalDependencies:" >&2
            cat "$optional_dependency_names_file" >&2
            echo "platform package names:" >&2
            cat "$platform_names_file" >&2
            exit 1
          fi
        }

        validate_platform_metadata
      '';
}
