{
  self,
  pkgs,
  nix2containerPkgs,
  nixops-lib,
}:
let
  name = "dashboard";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "${name}";

  fs = pkgs.lib.fileset;

  node_modules = nixops-lib.js.mkNodeModules {
    name = "node-modules-${name}";
    version = "0.0.0-dev";

    src = fs.toSource {
      root = ./..;
      fileset = fs.unions [
        ../.npmrc
        ../package.json
        ../pnpm-workspace.yaml
        ../pnpm-lock.yaml
        ./package.json
        ./pnpm-lock.yaml
      ];
    };

    pnpmOpts = "--filter . --filter './${submodule}/**'";

    preBuild = ''
      mkdir packages
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js
    '';
  };

  src = fs.toSource {
    root = ../.;
    fileset = fs.unions [
      ../.npmrc
      ../audit-ci.jsonc
      ../package.json
      ../pnpm-workspace.yaml
      ../pnpm-lock.yaml
      ../turbo.json
      ../biome.json
      ../.gitignore
      ../build/configs
      ./.env.example
      ./biome.json
      ./.lychee.toml
      ./components.json
      ./graphite.graphql.config.yaml
      ./graphql.config.yaml
      ./next.config.js
      ./package.json
      ./pnpm-lock.yaml
      ./playwright.config.ts
      ./postcss.config.js
      ./tailwind.config.js
      ./tsconfig.json
      ./tsconfig.test.json
      ./vitest.config.mts
      ./vitest.global-setup.ts
      ./e2e
      ./public
      ./src
    ];
  };

  checkDeps = with pkgs; [
    nhost.nhost-cli
    lychee
    playwright-driver
  ];

  buildInputs = with pkgs; [ nhost.nodejs ];

  nativeBuildInputs = with pkgs; [
    nhost.pnpm
    cacert
  ];

  e2eEnvVars = [
    "NHOST_TEST_DASHBOARD_URL"
    "NHOST_TEST_PROJECT_NAME"
    "NHOST_TEST_ORGANIZATION_NAME"
    "NHOST_TEST_ORGANIZATION_SLUG"
    "NHOST_TEST_PERSONAL_ORG_SLUG"
    "NHOST_TEST_PROJECT_SUBDOMAIN"
    "NHOST_TEST_PROJECT_REMOTE_SCHEMA_NAME"
    "NHOST_PRO_TEST_PROJECT_NAME"
    "NHOST_TEST_USER_EMAIL"
    "NHOST_TEST_USER_PASSWORD"
    "NHOST_TEST_ONBOARDING_USER"
    "NHOST_TEST_PROJECT_ADMIN_SECRET"
    "NHOST_TEST_STAGING_SUBDOMAIN"
    "NHOST_TEST_STAGING_REGION"
  ];

  mkDashboardE2ECheck =
    { suite, script }:
    pkgs.runCommand "dashboard-e2e-staging-${suite}"
      {
        __noChroot = true;
        nativeBuildInputs = checkDeps ++ buildInputs ++ nativeBuildInputs;
        NHOST_DASHBOARD_E2E_ENV_FILE = "/tmp/nhost-dashboard-e2e-${suite}.env";
      }
      ''
        if [ -z "$NHOST_DASHBOARD_E2E_ENV_FILE" ]; then
          echo "ERROR: NHOST_DASHBOARD_E2E_ENV_FILE environment variable is not set"
          exit 1
        fi

        if [ ! -f "$NHOST_DASHBOARD_E2E_ENV_FILE" ]; then
          echo "ERROR: NHOST_DASHBOARD_E2E_ENV_FILE does not point to a file"
          exit 1
        fi

        set -a
        . "$NHOST_DASHBOARD_E2E_ENV_FILE"
        set +a

        for env_var in ${pkgs.lib.escapeShellArgs e2eEnvVars}; do
          if [ -z "''${!env_var:-}" ]; then
            echo "ERROR: $env_var environment variable is not set"
            exit 1
          fi
        done

        export CI="''${CI:-true}"
        export NEXT_PUBLIC_ENV="''${NEXT_PUBLIC_ENV:-dev}"
        export NEXT_TELEMETRY_DISABLED="''${NEXT_TELEMETRY_DISABLED:-1}"
        export HOME=$TMPDIR
        export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
        export NIX_SSL_CERT_FILE=$SSL_CERT_FILE
        export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
        export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true

        cp -r ${src}/. .
        chmod +w -R .

        ln -s ${node_modules}/node_modules node_modules
        ln -s ${node_modules}/dashboard/node_modules dashboard/node_modules

        mkdir -p packages
        rm -rf packages/nhost-js
        cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js

        cd dashboard

        echo "➜ Running dashboard staging e2e tests (${suite})"
        ${script}

        mkdir -p $out
      '';

  vercelPrepare = ''
    cp -r ${node_modules}/node_modules/ node_modules
    cp -r ${node_modules}/dashboard/node_modules/ dashboard/node_modules
    chmod +w -R node_modules dashboard/node_modules

    mkdir -p packages
    rm -rf packages/nhost-js
    cp -r ${self.packages.${pkgs.stdenv.hostPlatform.system}.nhost-js} packages/nhost-js
    chmod +w -R packages
  '';
in
rec {
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs =
      with pkgs;
      [
        nhost.vercel
      ]
      ++ checkDeps
      ++ buildInputs
      ++ nativeBuildInputs;

    shellHook = ''
      export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
      export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
    '';

  };

  entrypoint = pkgs.writeScriptBin "docker-entrypoint.sh" (builtins.readFile ./docker-entrypoint.sh);

  check = nixops-lib.js.check {
    inherit
      src
      node_modules
      submodule
      buildInputs
      nativeBuildInputs
      checkDeps
      ;

    preCheck = ''
      mkdir -p packages
      rm -rf packages/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js
    '';
  };

  check-staging-main = mkDashboardE2ECheck {
    suite = "main";
    script = "pnpm e2e";
  };

  check-staging-onboarding = mkDashboardE2ECheck {
    suite = "onboarding";
    script = "pnpm e2e:onboarding";
  };

  check-staging-local = mkDashboardE2ECheck {
    suite = "local";
    script = "pnpm e2e:local";
  };

  vercelPreview = nixops-lib.js.mkVercel {
    inherit
      src
      node_modules
      buildInputs
      nativeBuildInputs
      ;
    name = "dashboard";
    environment = "preview";
    prepare = vercelPrepare;
  };

  vercelProduction = nixops-lib.js.mkVercel {
    inherit
      src
      node_modules
      buildInputs
      nativeBuildInputs
      ;
    name = "dashboard";
    environment = "production";
    prepare = vercelPrepare;
  };

  vercelBuildPreview = vercelPreview.build;
  vercelDeployPreview = vercelPreview.deploy;
  vercelBuildProduction = vercelProduction.build;
  vercelDeployProduction = vercelProduction.deploy;

  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [
      nhost.pnpm
      cacert
      nhost.nodejs
    ];
    buildInputs = with pkgs; [ nhost.nodejs ];

    configurePhase = ''
      export NEXT_PUBLIC_DASHBOARD_VERSION=${version}
      export NEXT_PUBLIC_NHOST_ADMIN_SECRET=__NEXT_PUBLIC_NHOST_ADMIN_SECRET__
      export NEXT_PUBLIC_NHOST_AUTH_URL=__NEXT_PUBLIC_NHOST_AUTH_URL__
      export NEXT_PUBLIC_NHOST_FUNCTIONS_URL=__NEXT_PUBLIC_NHOST_FUNCTIONS_URL__
      export NEXT_PUBLIC_NHOST_GRAPHQL_URL=__NEXT_PUBLIC_NHOST_GRAPHQL_URL__
      export NEXT_PUBLIC_NHOST_STORAGE_URL=__NEXT_PUBLIC_NHOST_STORAGE_URL__
      export NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL=__NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL__
      export NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL=__NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL__
      export NEXT_PUBLIC_NHOST_HASURA_API_URL=__NEXT_PUBLIC_NHOST_HASURA_API_URL__
      export NEXT_PUBLIC_NHOST_CONFIGSERVER_URL=__NEXT_PUBLIC_NHOST_CONFIGSERVER_URL__
      export NEXT_PUBLIC_NHOST_APP_ID=__NEXT_PUBLIC_NHOST_APP_ID__
    '';

    buildPhase = ''
      cp -r ${node_modules}/node_modules/ node_modules
      cp -r ${node_modules}/dashboard/node_modules/ dashboard/node_modules

      mkdir -p packages
      rm -rf packages/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js

      cd dashboard
      pnpm build
    '';

    installPhase = ''
      cp -r .next/standalone $out

      mkdir -p $out/dashboard/.next
      cp -r .next/static $out/dashboard/.next/static
      cp -r public $out/dashboard/public

      # pnpm 11 produces more .pnpm/node_modules/<pkg> indirection symlinks
      # than pnpm 10. Next.js NFT copies some of these without their targets,
      # leaving dangling symlinks that fail Nix's noBrokenSymlinks fixup check.
      # These point at packages that aren't runtime deps, so prune them.
      find $out -xtype l -delete
    '';
  };

  packageWithDisabledCSP = package.overrideAttrs (oldAttrs: {
    configurePhase = oldAttrs.configurePhase + ''
      export CSP_MODE=disabled
    '';
  });

  dockerImage = pkgs.runCommand "image-as-dir" { } ''
    ${
      (nix2containerPkgs.nix2container.buildImage {
        inherit name created;
        tag = version;
        maxLayers = 100;

        copyToRoot = pkgs.buildEnv {
          name = "image";
          paths = [
            packageWithDisabledCSP
            (pkgs.writeTextFile {
              name = "tmp-file";
              text = ''
                dummy file to generate tmpdir
              '';
              destination = "/tmp/tmp-file";
            })
            pkgs.busybox
          ];
        };

        config = {
          Env = [
            "TMPDIR=/tmp"
            "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
            "NEXT_TELEMETRY_DISABLED=1"
            "NEXT_PUBLIC_ENV=dev"
            "NEXT_PUBLIC_NHOST_PLATFORM=false"
            "NEXT_PUBLIC_DASHBOARD_VERSION=${version}"
            # placeholders for URLs, will be replaced on runtime by entrypoint script
            "NEXT_PUBLIC_NHOST_ADMIN_SECRET=__NEXT_PUBLIC_NHOST_ADMIN_SECRET__"
            "NEXT_PUBLIC_NHOST_AUTH_URL=__NEXT_PUBLIC_NHOST_AUTH_URL__"
            "NEXT_PUBLIC_NHOST_FUNCTIONS_URL=__NEXT_PUBLIC_NHOST_FUNCTIONS_URL__"
            "NEXT_PUBLIC_NHOST_GRAPHQL_URL=__NEXT_PUBLIC_NHOST_GRAPHQL_URL__"
            "NEXT_PUBLIC_NHOST_STORAGE_URL=__NEXT_PUBLIC_NHOST_STORAGE_URL__"
            "NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL=__NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL__"
            "NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL=__NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL__"
            "NEXT_PUBLIC_NHOST_HASURA_API_URL=__NEXT_PUBLIC_NHOST_HASURA_API_URL__"
            "NEXT_PUBLIC_NHOST_CONFIGSERVER_URL=__NEXT_PUBLIC_NHOST_CONFIGSERVER_URL__"
            "NEXT_PUBLIC_NHOST_APP_ID=__NEXT_PUBLIC_NHOST_APP_ID__"
          ];
          Entrypoint = [
            "${entrypoint}/bin/docker-entrypoint.sh"
            "${pkgs.nhost.nodejs}/bin/node"
            "/dashboard/server.js"
          ];
        };
      }).copyTo
    }/bin/copy-to dir:$out
  '';
}
