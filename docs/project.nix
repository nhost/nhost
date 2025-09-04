{ self, pkgs, nixops-lib, nix-filter }:
let
  name = "docs";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "${name}";

  node_modules = nixops-lib.js.mkNodeModules {
    name = "node-modules";
    version = "0.0.0-dev";

    src = nix-filter.lib.filter {
      root = ../.;
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
    root = ../.;
    include = with nix-filter.lib; [
      isDirectory
      ".npmrc"
      ".prettierignore"
      ".prettierrc.js"
      "audit-ci.jsonc"
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
      ../packages/nhost-js/api/auth.yaml
      ../packages/nhost-js/api/storage.yaml
      ../packages/nhost-js/tsconfig.json
      ../build/configs/tsconfig/library.json
      ../build/configs/tsconfig/base.json
    ];
  };

  checkDeps = [ self.packages.${pkgs.system}.mintlify-openapi ];

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
      cp -r ${self.packages.${pkgs.system}.nhost-js}/dist packages/nhost-js/dist
      cp -r ${self.packages.${pkgs.system}.nhost-js}/node_modules packages/nhost-js/node_modules
    '';
  };
}
