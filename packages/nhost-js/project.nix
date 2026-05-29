{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-js";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
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
      ./gen.sh
      ./jest.config.cjs
      ./package.json
      ./pnpm-lock.yaml
      ./tsconfig.json
      ./vite.config.ts
      ./vite.umd.config.ts
      ./src
      ../../services/auth/docs/openapi.yaml
      ../../services/storage/controller/openapi.yaml
    ];
  };

  checkDeps = with pkgs; [
    nhost-cli
    self.packages.${pkgs.system}.codegen
  ];

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
        vercel
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

  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [
      pnpm
      cacert
      nodejs
    ];
    buildInputs = with pkgs; [ nodejs ];

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
