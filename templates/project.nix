{
  pkgs,
  nixops-lib,
}:
let
  name = "templates";
  version = "0.0.0-dev";

  fs = pkgs.lib.fileset;

  templates = [
    { name = "nextjs"; }
    {
      name = "react-native";
      postBuild = ''
        for platform in ios android; do
          if [ -z "$(ls -A dist/_expo/static/js/$platform 2>/dev/null)" ]; then
            echo "no $platform bundle in dist"
            exit 1
          fi
        done
      '';
    }
  ];

  forEachTemplate = f: pkgs.lib.concatMapStringsSep "\n" f templates;

  frontendOf = template: ./. + "/${template.name}/frontend";

  # Each template is a standalone app with its own lockfile, outside the root
  # pnpm workspace, so it installs and runs exactly as a scaffolded copy does.
  nodeModulesOf =
    template:
    nixops-lib.js.mkNodeModules {
      name = "node-modules-${name}-${template.name}";
      inherit version;

      src = fs.toSource {
        root = frontendOf template;
        fileset = fs.unions [
          (frontendOf template + "/package.json")
          (frontendOf template + "/pnpm-lock.yaml")
          (frontendOf template + "/pnpm-workspace.yaml")
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
    fileset = fs.unions (map (template: ./. + "/${template.name}") templates);
  };

  nativeBuildInputs = with pkgs; [
    nhost.nodejs
    nhost.pnpm
    cacert
  ];

  setup = ''
    export HOME=$(mktemp -d)
    export NEXT_TELEMETRY_DISABLED=1
    # Keep Expo off the network and non-interactive. The React Native export
    # passes `--no-bytecode`, so it never runs the prebuilt `hermesc`, which
    # does not run on NixOS.
    export EXPO_OFFLINE=1
    export EXPO_NO_TELEMETRY=1
    export CI=1
    # node_modules comes prebuilt from the store; don't let `pnpm run` reinstall.
    export pnpm_config_verify_deps_before_run=false

    cp -r ${src} src
    chmod +w -R src
    ${forEachTemplate (template: ''
      cp -r ${nodeModulesOf template}/node_modules src/templates/${template.name}/frontend/node_modules
    '')}
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

        ${forEachTemplate (template: ''
          echo "➜ ${template.name}: audit"
          (cd src && pnpm audit-ci --directory templates/${template.name}/frontend)

          pushd src/templates/${template.name}/frontend

          echo "➜ ${template.name}: lint"
          pnpm lint

          echo "➜ ${template.name}: typecheck"
          pnpm exec tsc --noEmit

          echo "➜ ${template.name}: test"
          pnpm test

          popd
        '')}

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

        ${forEachTemplate (template: ''
          pushd src/templates/${template.name}/frontend

          echo "➜ ${template.name}: build"
          pnpm build
          ${template.postBuild or ""}

          popd
        '')}

        mkdir $out
      '';
}
