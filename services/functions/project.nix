{
  self,
  pkgs,
  nix2containerPkgs,
  nix-filter,
  nixops-lib,
}:
let
  name = "functions";
  description = "Nhost Functions Development Runtime";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "services/${name}";

  mkNodeModules =
    pnpmOpts:
    nixops-lib.js.mkNodeModules {
      name = "node-modules-${name}";
      version = "0.0.0-dev";
      src = nix-filter.lib.filter {
        root = ../..;
        include = [
          ".npmrc"
          "package.json"
          "pnpm-workspace.yaml"
          "pnpm-lock.yaml"
          "${submodule}/package.json"
          "${submodule}/pnpm-lock.yaml"
        ];
      };
      inherit pnpmOpts;
    };

  # Full node_modules including root deps (audit-ci, etc.) for check and devShell
  node_modules = mkNodeModules "--filter . --filter './${submodule}/**'";

  # Slim node_modules with only runtime deps for the Docker image
  node_modules_runtime = mkNodeModules "--filter './${submodule}/**'";

  src = nix-filter.lib.filter {
    root = ../..;
    include = with nix-filter.lib; [
      isDirectory
      ".gitignore"
      ".npmrc"
      "biome.json"
      "audit-ci.jsonc"
      "package.json"
      "pnpm-workspace.yaml"
      "pnpm-lock.yaml"
      "${submodule}/server.js"
      "${submodule}/local-wrapper.js"
      "${submodule}/start.sh"
      "${submodule}/tsconfig.json"
      "${submodule}/package.json"
      "${submodule}/pnpm-lock.yaml"
      "${submodule}/jest.config.cjs"
      (nix-filter.lib.inDirectory "${submodule}/test")
    ];
  };

  serverFiles = pkgs.stdenv.mkDerivation {
    pname = "${name}-server";
    inherit version;

    src = nix-filter.lib.filter {
      root = ./.;
      include = [
        "server.js"
        "local-wrapper.js"
        "start.sh"
        "tsconfig.json"
      ];
    };

    dontBuild = true;

    installPhase = ''
      mkdir -p $out/opt/server
      cp server.js local-wrapper.js tsconfig.json $out/opt/server/
      cp start.sh $out/opt/server/
      chmod +x $out/opt/server/start.sh
    '';
  };

  mkDockerImage =
    { nodejs }:
    pkgs.runCommand "image-as-dir" { } ''
      ${
        (nix2containerPkgs.nix2container.buildImage {
          inherit name created;
          tag = version;
          maxLayers = 100;

          copyToRoot = pkgs.buildEnv {
            name = "image";
            paths = [
              serverFiles
              pkgs.busybox
              nodejs
              pkgs.gitMinimal
              pkgs.openssh
              pkgs.cacert
              (pkgs.writeTextFile {
                name = "tmp-file";
                text = "dummy file to generate tmpdir";
                destination = "/tmp/.keep";
              })
              (pkgs.writeTextFile {
                name = "project-dir";
                text = "";
                destination = "/opt/project/.keep";
              })
            ];
          };

          config = {
            Env = [
              "TMPDIR=/tmp"
              "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
              "NODE_PATH=${node_modules_runtime}/${submodule}/node_modules"
              "PATH=/tmp/corepack-shims:${node_modules_runtime}/${submodule}/node_modules/.bin:${nodejs}/bin:${pkgs.gitMinimal}/bin:${pkgs.openssh}/bin:/bin:/usr/bin"
              "SERVER_PATH=/opt/server"
              "NHOST_PROJECT_PATH=/opt/project"
              "PACKAGE_MANAGER=pnpm"
              "NODE_OPTIONS=--enable-source-maps"
              "NPM_CONFIG_STORE_DIR=/opt/project/node_modules/.pnpm-store"
            ];
            WorkingDir = "/opt/project";
            Entrypoint = [
              "/bin/sh"
              "/opt/server/start.sh"
            ];
          };
        }).copyTo
      }/bin/copy-to dir:$out
    '';

  checkDeps = with pkgs; [ ];

  buildInputs = with pkgs; [ nodejs ];

  nativeBuildInputs = with pkgs; [
    pnpm
    cacert
  ];
in
{
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs =
      with pkgs;
      [
      ]
      ++ checkDeps
      ++ buildInputs
      ++ nativeBuildInputs;
  };

  check = nixops-lib.js.check {
    inherit
      src
      node_modules
      submodule
      buildInputs
      nativeBuildInputs
      checkDeps
      ;
  };

  package = serverFiles;

  node22DockerImage = mkDockerImage { nodejs = pkgs.nodejs_22; };
  node24DockerImage = mkDockerImage { nodejs = pkgs.nodejs_24; };
}
