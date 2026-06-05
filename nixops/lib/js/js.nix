{ pkgs, nix2containerPkgs }:
let
  jsCheckDeps = with pkgs; [
    pnpm
    cacert
    nodejs
    biome
  ];

  mkNodeModules =
    {
      src,
      name,
      version,
      preBuild ? "",
      pnpmOpts ? "",
    }:
    pkgs.stdenv.mkDerivation {
      inherit name version src;

      __noChroot = true;
      dontFixup = true;

      nativeBuildInputs = with pkgs; [
        pnpm
        cacert
        nodejs
      ];

      buildPhase = ''
        export HOME=$(mktemp -d)

        ${preBuild}

        pnpm install --frozen-lockfile ${pnpmOpts}
      '';

      installPhase = ''
        mkdir -p $out

        for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
          dir=$(realpath --relative-to="$PWD" "$absdir")
          echo "  ➜ Copying node_modules for $dir"
          mkdir -p $out/$dir
          cp -r $dir/node_modules $out/$dir/node_modules
        done
      '';
    };

  devShell =
    {
      node_modules,
      buildInputs ? [ ],
      shellHook ? "",
    }:
    pkgs.mkShell {

      buildInputs = jsCheckDeps ++ buildInputs;

      shellHook = ''
        CUR_DIR=$(pwd)
        PRJ_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
        cd "$PRJ_ROOT"

        rm -rf node_modules
        ln -sf ${node_modules}/node_modules node_modules

        for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
          dir=$(realpath --relative-to="$PWD" "$absdir")
          rm -rf $dir/node_modules
          ln -sf ${node_modules}/$dir/node_modules $dir/node_modules
        done

        cd "$CUR_DIR"

        ${shellHook}
      '';
    };

  check =
    {
      src,
      node_modules,
      submodule ? "",
      buildInputs,
      nativeBuildInputs,
      checkDeps ? [ ],
      preCheck ? "",
      extraCheck ? "",
    }:
    pkgs.runCommand "jstests"
      {
        __noChroot = true;
        nativeBuildInputs = jsCheckDeps ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
      }
      ''
        export HOME=$(mktemp -d)

        cp -r ${src} src
        chmod +w -R .

        echo "➜ Source: ${src}"
        echo "➜ Workdir: $(realpath src)"
        echo "➜ Setting up node_modules and checking dependencies for security issues"
        cd src

        for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
          dir=$(realpath --relative-to="$PWD" "$absdir")
          echo "  ➜ Copying node_modules for $dir"
          cp -r ${node_modules}/$dir/node_modules $dir/node_modules

          echo "  ➜ Running pnpm audit-ci for $dir"
          pnpm audit-ci --directory $dir

        done

        ${preCheck}

        echo "➜ Running pnpm generate and checking sha1sum of all files"

        # Generate baseline checksums from the original filtered src
        find . -type f ! -path "*/node_modules/*" ! -path "./deprecated/*" -print0 | xargs -0 sha1sum > $TMPDIR/baseline

        # Copy and run generate
        pnpm run --dir ${submodule} generate

        # Check only files that existed in the baseline
        sha1sum -c $TMPDIR/baseline || (echo "❌ ERROR: pnpm generate changed files" && exit 1)


        echo "➜ Running linters and tests"
        pnpm run --dir ${submodule} test

        ${extraCheck}

        mkdir $out
      '';

  mkVercel =
    {
      name,
      src,
      node_modules,
      environment,
      prepare ? "",
      buildInputs ? [ ],
      nativeBuildInputs ? [ ],
    }:
    let
      envFile = "/tmp/nhost-vercel-${name}-${environment}.env";
      # Keep package enumeration pure; setupVercel fails during the build if
      # these impure cache-key hashes are missing or stale.
      impureCacheKeyHash =
        envVar:
        let
          value = builtins.getEnv envVar;
        in
        pkgs.lib.optionalAttrs (value != "") {
          "${envVar}_HASH" = builtins.hashString "sha256" value;
        };
      cacheKeyHashes = impureCacheKeyHash "VERCEL_ORG_ID" // impureCacheKeyHash "VERCEL_PROJECT_ID";
      vercelBuildInputs =
        jsCheckDeps
        ++ (with pkgs; [
          corepack
          jq
          vercel
        ])
        ++ buildInputs
        ++ nativeBuildInputs;
      setupVercel = ''
        if [ -z "$VERCEL_ENV_FILE" ]; then
          echo "ERROR: VERCEL_ENV_FILE environment variable is not set"
          exit 1
        fi

        if [ ! -f "$VERCEL_ENV_FILE" ]; then
          echo "ERROR: VERCEL_ENV_FILE does not point to a file"
          exit 1
        fi

        set -a
        . "$VERCEL_ENV_FILE"
        set +a

        for env_var in VERCEL_ORG_ID VERCEL_PROJECT_ID VERCEL_DEPLOY_TOKEN; do
          if [ -z "''${!env_var:-}" ]; then
            echo "ERROR: $env_var environment variable is not set"
            exit 1
          fi
        done

        require_impure_hash() {
          env_var="$1"
          hash_var="''${env_var}_HASH"

          if [ -z "''${!hash_var:-}" ]; then
            echo "ERROR: $hash_var derivation attribute is not set"
            echo "Export $env_var and evaluate with --impure so Vercel cache keys include the current project/config state."
            exit 1
          fi

          actual_hash=$(printf '%s' "''${!env_var}" | sha256sum | cut -d ' ' -f 1)
          if [ "''${!hash_var}" != "$actual_hash" ]; then
            echo "ERROR: $hash_var does not match $env_var from $VERCEL_ENV_FILE"
            echo "Export the same $env_var value from $VERCEL_ENV_FILE and evaluate with --impure."
            exit 1
          fi
        }

        for env_var in VERCEL_ORG_ID VERCEL_PROJECT_ID; do
          require_impure_hash "$env_var"
        done

        export HOME=$(mktemp -d)
        export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
        export NIX_SSL_CERT_FILE=$SSL_CERT_FILE
        export NEXT_TELEMETRY_DISABLED="''${NEXT_TELEMETRY_DISABLED:-1}"
        export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
        export VERCEL_TELEMETRY_DISABLED=1
        export TURBO_TEAM="''${TURBO_TEAM:-nhost}"

        mkdir -p .vercel
        jq -n \
          --arg orgId "$VERCEL_ORG_ID" \
          --arg projectId "$VERCEL_PROJECT_ID" \
          '{ orgId: $orgId, projectId: $projectId }' > .vercel/project.json
      '';
      build =
        pkgs.runCommand "${name}-vercel-build-${environment}"
          (
            {
              __noChroot = true;
              nativeBuildInputs = vercelBuildInputs;
              VERCEL_ENV_FILE = envFile;
            }
            // cacheKeyHashes
          )
          ''
            cp -r ${src}/. .
            chmod +w -R .

            ${prepare}
            ${setupVercel}

            echo "➜ Pulling Vercel ${environment} environment for ${name}"
            vercel pull --yes --environment=${environment} --token "$VERCEL_DEPLOY_TOKEN"

            echo "➜ Building Vercel ${environment} output for ${name}"
            vercel build --yes --target=${environment} --token "$VERCEL_DEPLOY_TOKEN"

            for next_package in $(find . -path '*/.next/package.json' -type f); do
              project_dir="''${next_package%/.next/package.json}"
              project_dir="''${project_dir#./}"
              find .vercel/output/functions \
                -path "*/$project_dir/.next" \
                -type d \
                -exec cp "$next_package" '{}/package.json' \;
            done

            mkdir -p $out/.vercel
            cp -r .vercel/output $out/.vercel/output

            for next_dir in $(find . -path './.vercel' -prune -o -path '*/.next' -type d -print); do
              project_dir="''${next_dir%/.next}"
              project_dir="''${project_dir#./}"
              mkdir -p "$out/$project_dir"
              cp -r "$next_dir" "$out/$project_dir/.next"
            done
          '';
      deploy =
        pkgs.runCommand "${name}-vercel-deploy-${environment}"
          (
            {
              __noChroot = true;
              nativeBuildInputs = vercelBuildInputs;
              VERCEL_ENV_FILE = envFile;
            }
            // cacheKeyHashes
          )
          ''
            cp -r ${src}/. .
            chmod +w -R .

            ${prepare}
            ${setupVercel}

            cp -r ${build}/.vercel/output .vercel/output
            chmod +w -R .vercel

            find ${build} -path ${build}/.vercel -prune -o -path '*/.next' -type d -print0 |
              while IFS= read -r -d "" next_dir; do
                project_dir=$(realpath --relative-to="${build}" "''${next_dir%/.next}")
                mkdir -p "$project_dir"
                rm -rf "$project_dir/.next"
                cp -r "$next_dir" "$project_dir/.next"
                chmod +w -R "$project_dir/.next"
              done

            echo "➜ Deploying prebuilt Vercel ${environment} output for ${name}"
            vercel deploy \
              --yes \
              --target=${environment} \
              --prebuilt \
              --token "$VERCEL_DEPLOY_TOKEN" \
              | tee $TMPDIR/vercel-output

            preview_url=$(grep -Eo 'https://[^[:space:]]+' $TMPDIR/vercel-output | tail -n 1 || true)
            if [ -z "$preview_url" ]; then
              echo "ERROR: Vercel deploy did not print a deployment URL"
              cat $TMPDIR/vercel-output
              exit 1
            fi

            mkdir -p $out
            printf '%s\n' "$preview_url" > $out/preview-url
            cp $TMPDIR/vercel-output $out/vercel-output
          '';
    in
    {
      inherit build deploy;
    };
in
{
  inherit
    mkNodeModules
    devShell
    check
    mkVercel
    ;
}
