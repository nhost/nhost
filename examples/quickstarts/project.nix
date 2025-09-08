{ self, pkgs, nix2containerPkgs, nix-filter, nixops-lib }:
let
  name = "quickstarts";
  version = "0.0.0-dev";
  submodule = "examples/${name}";

  node_modules = nixops-lib.js.mkNodeModules {
    name = "node-modules-${name}";
    version = "0.0.0-dev";

    src = nix-filter.lib.filter {
      root = ../..;
      include = [
        ".npmrc "
        "package.json"
        "pnpm-workspace.yaml "
        "pnpm-lock.yaml"
        "${submodule}/package.json"
        "${submodule}/pnpm-lock.yaml"
        "${submodule}/react/package.json"
        "${submodule}/react/pnpm-lock.yaml"
      ];
    };

    pnpmOpts = "--filter . --filter './${submodule}/**'";

    preBuild = ''
      mkdir packages
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js
    '';
  };

  src = nix-filter.lib.filter {
    root = ../../.;
    include = with nix-filter.lib; [
      isDirectory
      ".gitignore"
      ".npmrc"
      "audit-ci.jsonc"
      "biome.json"
      "package.json"
      "pnpm-workspace.yaml"
      "pnpm-lock.yaml"
      "turbo.json"
      (inDirectory "./build")
      (inDirectory "${submodule}")
    ];
  };

  checkDeps = with pkgs; [ nhost-cli biome ];

  buildInputs = with pkgs; [ nodejs ];

  nativeBuildInputs = with pkgs; [ pnpm cacert ];
in
{
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs = [
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  check = nixops-lib.js.check {
    inherit src node_modules submodule buildInputs nativeBuildInputs checkDeps;

    preCheck = ''
      rm -rf packages/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js} packages/nhost-js
    '';
  };

  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [ pnpm cacert nodejs ];
    buildInputs = with pkgs; [ nodejs ];

    buildPhase = ''
      mkdir -p $TMPDIR/home
      export HOME=$TMPDIR/home

      chmod +w -R .

      for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
        dir=$(realpath --relative-to="$PWD" "$absdir")
        echo "➜ Copying node_modules for $dir"
        cp -r ${node_modules}/$dir/node_modules $dir/node_modules
      done

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
