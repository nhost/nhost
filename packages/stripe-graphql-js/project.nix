{ self, pkgs, nix-filter, nixops-lib }:
let
  name = "stripe-graphql-js";
  version = "0.0.0-dev";
  submodule = "packages/${name}";

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
      "turbo.json"
      (inDirectory "./build")
      "${submodule}/package.json"
      "${submodule}/pnpm-lock.yaml"
      "${submodule}/tsconfig.json"
      "${submodule}/vite.config.ts"
      (inDirectory "${submodule}/src")
    ];
  };

  buildInputs = with pkgs; [ nodejs ];

  nativeBuildInputs = with pkgs; [ pnpm cacert ];
in
{
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs = with pkgs;[
    ] ++ buildInputs ++ nativeBuildInputs;
  };

  check = nixops-lib.js.check {
    inherit src node_modules submodule buildInputs nativeBuildInputs;
  };

  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [ pnpm cacert nodejs ];
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
