{ self, pkgs, nixops-lib, nix-filter }:
let
  name = "docs-starlight";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "${name}";

  node_modules = nixops-lib.js.mkNodeModules {
    name = "node-modules-${name}";
    version = "0.0.0-dev";

    src = nix-filter.lib.filter {
      root = ../.;
      include = with nix-filter.lib; [
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
    root = ../.;
    include = with nix-filter.lib; [
      isDirectory
      ".npmrc"
      ".prettierignore"
      ".prettierrc.js"
      ".gitignore"
      "audit-ci.jsonc"
      "biome.json"
      "package.json"
      "pnpm-workspace.yaml"
      "pnpm-lock.yaml"
      "turbo.json"
      (inDirectory "./build")
      (inDirectory "${submodule}")
      (and
        (inDirectory "packages/nhost-js/src")
        (matchExt "ts")
      )
      ../services/auth/docs/openapi.yaml
      ../services/storage/controller/openapi.yaml
      ../packages/nhost-js/tsconfig.json
      ../build/configs/tsconfig/library.json
      ../build/configs/tsconfig/base.json
    ];
  };

  checkDeps = with pkgs; [
    # self.packages.${pkgs.stdenv.hostPlatform.system}.cli
    vale
  ];

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
      mkdir -p packages/nhost-js
      cp -r ${self.packages.${pkgs.stdenv.hostPlatform.system}.nhost-js}/dist packages/nhost-js/dist
      cp -r ${self.packages.${pkgs.stdenv.hostPlatform.system}.nhost-js}/node_modules packages/nhost-js/node_modules
    '';
  };
}
