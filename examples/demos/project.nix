{
  self,
  pkgs,
  nix2containerPkgs,
  nixops-lib,
}:
let
  name = "demos";
  version = "0.0.0-dev";
  submodule = "examples/${name}";

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
        ./express/package.json
        ./express/pnpm-lock.yaml
        ./react-demo/package.json
        ./react-demo/pnpm-lock.yaml
      ];
    };

    pnpmOpts = "--filter . --filter './${submodule}/**'";

    preBuild = ''
      mkdir packages
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js
    '';
  };

  src = fs.toSource {
    root = ../../.;
    fileset = fs.unions [
      ../../.gitignore
      ../../.npmrc
      ../../audit-ci.jsonc
      ../../biome.json
      ../../package.json
      ../../pnpm-workspace.yaml
      ../../pnpm-lock.yaml
      ../../turbo.json
      ../../build
      ./.
    ];
  };

  checkDeps = with pkgs; [
    nhost-cli
    biome
  ];

  buildInputs = with pkgs; [ nodejs-pinned ];

  nativeBuildInputs = with pkgs; [
    pnpm
    cacert
  ];
in
{
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs = [
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

    preCheck = ''
      mkdir -p packages
      rm -rf packages/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js
    '';
  };

  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [
      pnpm
      cacert
      nodejs-pinned
    ];
    buildInputs = with pkgs; [ nodejs-pinned ];

    buildPhase = ''
      mkdir -p $TMPDIR/home
      export HOME=$TMPDIR/home

      chmod +w -R .

      for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
        dir=$(realpath --relative-to="$PWD" "$absdir")
        echo "➜ Copying node_modules for $dir"
        cp -r ${node_modules}/$dir/node_modules $dir/node_modules
      done

      mkdir -p packages
      rm -rf packages/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js

      cd ${submodule}

      pnpm build
    '';

    installPhase = ''
      mkdir -p $out
    '';
  };
}
