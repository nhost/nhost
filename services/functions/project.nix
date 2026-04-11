{ self, pkgs, nix2containerPkgs, nix-filter, nixops-lib }:
let
  name = "functions";
  description = "Nhost Functions Development Runtime";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "services/${name}";

  node_modules = nixops-lib.js.mkNodeModules {
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

    pnpmOpts = "--filter . --filter './${submodule}/**'";
  };

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

  mkDockerImage = { nodejs }:
    pkgs.runCommand "image-as-dir" { } ''
      ${(nix2containerPkgs.nix2container.buildImage {
        inherit name created;
        tag = version;
        maxLayers = 100;

        copyToRoot = pkgs.buildEnv {
          name = "image";
          paths = [
            serverFiles
            pkgs.bash
            pkgs.coreutils
            pkgs.busybox
            nodejs
            pkgs.pnpm
            pkgs.git
            pkgs.openssh
            pkgs.python3
            pkgs.gnumake
            pkgs.gcc
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
            "NODE_PATH=${node_modules}/${submodule}/node_modules"
            "PATH=${node_modules}/${submodule}/node_modules/.bin:${nodejs}/bin:${pkgs.pnpm}/bin:${pkgs.git}/bin:${pkgs.bash}/bin:${pkgs.coreutils}/bin:${pkgs.gnumake}/bin:${pkgs.gcc}/bin:${pkgs.openssh}/bin:${pkgs.python3}/bin:/bin:/usr/bin"
            "SERVER_PATH=/opt/server"
            "NHOST_PROJECT_PATH=/opt/project"
            "PACKAGE_MANAGER=pnpm"
            "NODE_OPTIONS=--enable-source-maps"
          ];
          WorkingDir = "/opt/project";
          Entrypoint = [ "${pkgs.bash}/bin/bash" "/opt/server/start.sh" ];
        };
      }).copyTo}/bin/copy-to dir:$out
    '';

  checkDeps = with pkgs; [ ];

  buildInputs = with pkgs; [ nodejs ];

  nativeBuildInputs = with pkgs; [ pnpm cacert ];
in
{
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs = with pkgs;[
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  check = nixops-lib.js.check {
    inherit src node_modules submodule buildInputs nativeBuildInputs checkDeps;
  };

  package = serverFiles;

  dockerImage = mkDockerImage { nodejs = pkgs.nodejs_22; };

  node20DockerImage = mkDockerImage { nodejs = pkgs.nodejs_20; };
}
