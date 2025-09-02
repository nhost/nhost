{ self, pkgs, nix2containerPkgs, nix-filter, nixops-lib, node_modules }:
let
  name = "demos";
  version = "0.0.0-dev";
  submodule = "examples/${name}";

  src = nix-filter.lib.filter {
    root = ../.;
    include = with nix-filter.lib; [
      isDirectory
      (matchName "package.json")
      ".npmrc"
      ".prettierignore"
      ".prettierrc.js"
      "audit-ci.jsonc"
      "pnpm-workspace.yaml"
      "pnpm-lock.yaml"
      "turbo.json"
      (inDirectory "${submodule}")
    ];
  };

  checkDeps = with pkgs; [ nhost-cli ];

  buildInputs = with pkgs; [ nodejs ];

  nativeBuildInputs = with pkgs; [ pnpm cacert ];
in
{
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs = [
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  entrypoint = pkgs.writeScriptBin "docker-entrypoint.sh" (builtins.readFile ./docker-entrypoint.sh);

  check = nixops-lib.js.check {
    inherit src node_modules submodule buildInputs nativeBuildInputs checkDeps;

    preCheck = ''
      mkdir -p packages/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js}/dist packages/nhost-js/dist
    '';
  };
}



