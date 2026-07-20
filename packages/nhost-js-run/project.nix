{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-js-run";
  version = "0.0.0-dev";
  submodule = "packages/${name}";

  fs = pkgs.lib.fileset;

  node_modules = nixops-lib.js.mkNodeModules {
    name = "node-modules-${name}";
    version = "0.0.0-dev";

    src = fs.toSource {
      root = ../..;
      fileset = fs.unions [
        ../../.npmrc
        ../../package.json
        ../../pnpm-workspace.yaml
        ../../pnpm-lock.yaml
        ./package.json
        ./pnpm-lock.yaml
      ];
    };
  };

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../.gitignore
      ../../.npmrc
      ../../biome.json
      ../../audit-ci.jsonc
      ../../package.json
      ../../pnpm-workspace.yaml
      ../../pnpm-lock.yaml
      ../../turbo.json
      ../../build
      ./jest.config.cjs
      ./package.json
      ./pnpm-lock.yaml
      ./tsconfig.json
      ./src
    ];
  };

  checkDeps = [ ];

  buildInputs = with pkgs; [ nhost.nodejs ];

  nativeBuildInputs = with pkgs; [
    nhost.pnpm
    cacert
  ];
in
{
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs = checkDeps ++ buildInputs ++ nativeBuildInputs;
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

  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [
      nhost.pnpm
      cacert
      nhost.nodejs
    ];
    buildInputs = with pkgs; [ nhost.nodejs ];

    buildPhase = ''
      cp -r ${src} src
      chmod +w -R .
      cd src

      cp -r ${node_modules}/node_modules/ node_modules
      cp -r ${node_modules}/${submodule}/node_modules/ ${submodule}/node_modules

      cd ${submodule}

      pnpm build
    '';

    installPhase = ''
      cp -r ./ $out
    '';
  };
}
