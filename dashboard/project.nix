{ self, pkgs, nix2containerPkgs, nix-filter, nixops-lib }:
let
  name = "dashboard";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "${name}";

  node_modules = nixops-lib.js.mkNodeModules {
    name = "node-modules-${name}";
    version = "0.0.0-dev";

    src = nix-filter.lib.filter {
      root = ./..;
      include = [
        ".npmrc"
        "package.json"
        "pnpm-workspace.yaml"
        "pnpm-lock.yaml"
        "${submodule}/package.json"
        "${submodule}/pnpm-lock.yaml"
      ];
    };

    pnpmOpts = "--filter . --filter './${submodule}/**'";

    preBuild = ''
      mkdir packages
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js
    '';
  };


  src = nix-filter.lib.filter {
    root = ../.;
    include = with nix-filter.lib; [
      isDirectory
      ".npmrc"
      ".prettierignore"
      ".prettierrc.js"
      "audit-ci.jsonc"
      "package.json"
      "pnpm-workspace.yaml"
      "pnpm-lock.yaml"
      "turbo.json"
      "biome.json"
      ".gitignore"
      "${submodule}/.env.test"
      "${submodule}/.env.example"
      "${submodule}/eslint.config.mjs"
      "${submodule}/.lintstagedrc.json"
      "${submodule}/biome.json"
      "${submodule}/.npmrc"
      "${submodule}/.prettierignore"
      "${submodule}/components.json"
      "${submodule}/graphite.graphql.config.yaml"
      "${submodule}/graphql.config.yaml"
      "${submodule}/next-env.d.ts"
      "${submodule}/next.config.js"
      "${submodule}/package.json"
      "${submodule}/pnpm-lock.yaml"
      "${submodule}/playwright.config.ts"
      "${submodule}/postcss.config.js"
      "${submodule}/prettier.config.js"
      "${submodule}/react-table-config.d.ts"
      "${submodule}/tailwind.config.js"
      "${submodule}/tsconfig.json"
      "${submodule}/tsconfig.test.json"
      "${submodule}/vitest.config.ts"
      "${submodule}/vitest.global-setup.ts"
      (inDirectory "${submodule}/e2e")
      (inDirectory "${submodule}/public")
      (inDirectory "${submodule}/src")
    ];
  };

  checkDeps = with pkgs; [
    nhost-cli
    playwright-driver
  ];

  buildInputs = with pkgs; [ nodejs ];

  nativeBuildInputs = with pkgs; [ pnpm cacert ];
in
rec {
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs = with pkgs;[
      nodePackages.vercel
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;

    shellHook = ''
      export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
      export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
    '';

  };

  entrypoint = pkgs.writeScriptBin "docker-entrypoint.sh" (builtins.readFile ./docker-entrypoint.sh);

  check = nixops-lib.js.check {
    inherit src node_modules submodule buildInputs nativeBuildInputs checkDeps;

    preCheck = ''
      rm -rf packages/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js
    '';
  };

  check-staging = pkgs.runCommand "check"
    {
      nativeBuildInputs = checkDeps ++ buildInputs ++ nativeBuildInputs;
    } ''
    cp -r ${src}/* .
    chmod +w -R .

    cp -r ${node_modules}/node_modules/ node_modules
    cp -r ${node_modules}/dashboard/node_modules/ dashboard/node_modules

    rm -rf packages/nhost-js
    cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js

    export HOME=$TMPDIR

    cd dashboard

    echo "➜ Running e2e tests"
    pnpm e2e

    echo "➜ Running e2e tests (onboarding)"
    pnpm e2e:onboarding

    echo "➜ Running e2e tests against local Nhost instance"
    pnpm e2e:local

    mkdir -p $out
  '';


  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [ pnpm cacert nodejs ];
    buildInputs = with pkgs; [ nodejs ];

    configurePhase = ''
      export NEXT_PUBLIC_NHOST_ADMIN_SECRET=__NEXT_PUBLIC_NHOST_ADMIN_SECRET__
      export NEXT_PUBLIC_NHOST_AUTH_URL=__NEXT_PUBLIC_NHOST_AUTH_URL__
      export NEXT_PUBLIC_NHOST_FUNCTIONS_URL=__NEXT_PUBLIC_NHOST_FUNCTIONS_URL__
      export NEXT_PUBLIC_NHOST_GRAPHQL_URL=__NEXT_PUBLIC_NHOST_GRAPHQL_URL__
      export NEXT_PUBLIC_NHOST_STORAGE_URL=__NEXT_PUBLIC_NHOST_STORAGE_URL__
      export NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL=__NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL__
      export NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL=__NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL__
      export NEXT_PUBLIC_NHOST_HASURA_API_URL=__NEXT_PUBLIC_NHOST_HASURA_API_URL__
      export NEXT_PUBLIC_NHOST_CONFIGSERVER_URL=__NEXT_PUBLIC_NHOST_CONFIGSERVER_URL__
    '';

    buildPhase = ''
      cp -r ${node_modules}/node_modules/ node_modules
      cp -r ${node_modules}/dashboard/node_modules/ dashboard/node_modules

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
    '';
  };

  packageWithDisabledCSP = package.overrideAttrs (oldAttrs: {
    configurePhase = oldAttrs.configurePhase + ''
      export CSP_MODE=disabled
    '';
  });

  dockerImage = pkgs.runCommand "image-as-dir" { } ''
    ${(nix2containerPkgs.nix2container.buildImage {
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
        ];
        Entrypoint = [
          "${entrypoint}/bin/docker-entrypoint.sh" "${pkgs.nodejs}/bin/node" "/dashboard/server.js"
        ];
      };
    }).copyTo}/bin/copy-to dir:$out
  '';
}
