{
  pkgs,
  nixops-lib,
}:
let
  name = "templates";
  version = "0.0.0-dev";

  fs = pkgs.lib.fileset;

  # Each template is a standalone app with its own lockfile, outside the root
  # pnpm workspace, so it installs and runs exactly as a scaffolded copy does.
  nextjsNodeModules = nixops-lib.js.mkNodeModules {
    name = "node-modules-${name}-nextjs";
    inherit version;

    src = fs.toSource {
      root = ./nextjs/frontend;
      fileset = fs.unions [
        ./nextjs/frontend/package.json
        ./nextjs/frontend/pnpm-lock.yaml
        ./nextjs/frontend/pnpm-workspace.yaml
      ];
    };
  };

  # The root workspace's audit-ci and its config, which the examples run too.
  rootNodeModules = nixops-lib.js.mkNodeModules {
    name = "node-modules-${name}-root";
    inherit version;

    src = fs.toSource {
      root = ../.;
      fileset = fs.unions [
        ../.npmrc
        ../package.json
        ../pnpm-workspace.yaml
        ../pnpm-lock.yaml
      ];
    };

    pnpmOpts = "--filter .";
  };

  auditSrc = fs.toSource {
    root = ../.;
    fileset = fs.unions [
      ../.npmrc
      ../audit-ci.jsonc
      ../package.json
      ../pnpm-workspace.yaml
      ../pnpm-lock.yaml
    ];
  };

  src = fs.toSource {
    root = ../.;
    fileset = ./nextjs;
  };

  nativeBuildInputs = with pkgs; [
    nhost.nodejs
    nhost.pnpm
    cacert
  ];

  setup = ''
    export HOME=$(mktemp -d)
    export NEXT_TELEMETRY_DISABLED=1
    # node_modules comes prebuilt from the store; don't let `pnpm run` reinstall.
    export pnpm_config_verify_deps_before_run=false

    cp -r ${src} src
    chmod +w -R src
    cp -r ${nextjsNodeModules}/node_modules src/templates/nextjs/frontend/node_modules
  '';
in
{
  devShell = pkgs.mkShell {
    buildInputs = nativeBuildInputs ++ [ pkgs.nhost.nhost-cli ];
  };

  check =
    pkgs.runCommand "${name}-check"
      {
        __noChroot = true;
        inherit nativeBuildInputs;
      }
      ''
        ${setup}

        cp -r ${auditSrc}/. src
        chmod +w -R src
        cp -r ${rootNodeModules}/node_modules src/node_modules

        echo "➜ nextjs: audit"
        (cd src && pnpm audit-ci --directory templates/nextjs/frontend)

        cd src/templates/nextjs/frontend

        echo "➜ nextjs: lint"
        pnpm lint

        echo "➜ nextjs: typecheck"
        pnpm exec tsc --noEmit

        echo "➜ nextjs: test"
        pnpm test

        mkdir $out
      '';

  package =
    pkgs.runCommand "${name}-${version}"
      {
        __noChroot = true;
        inherit nativeBuildInputs;
      }
      ''
        ${setup}

        cd src/templates/nextjs/frontend

        echo "➜ nextjs: build"
        pnpm build

        mkdir $out
      '';
}
