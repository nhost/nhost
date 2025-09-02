{ self, pkgs, nix2containerPkgs, nix-filter, nixops-lib, node_modules }:
let
  name = "demos";
  version = "0.0.0-dev";
  submodule = "examples/${name}";

  src = nix-filter.lib.filter {
    root = ../../.;
    include = with nix-filter.lib; [
      isDirectory
      (matchName "package.json")
      ".npmrc"
      ".prettierignore"
      ".prettierrc.js"
      "audit-ci.jsonc"
      "biome.json"
      "pnpm-workspace.yaml"
      "pnpm-lock.yaml"
      "turbo.json"
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

  entrypoint = pkgs.writeScriptBin "docker-entrypoint.sh" (builtins.readFile ./docker-entrypoint.sh);

  check = nixops-lib.js.check {
    inherit src node_modules submodule buildInputs nativeBuildInputs checkDeps;

    preCheck = ''
      mkdir -p packages/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js}/dist packages/nhost-js/dist
    '';
  };

  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [ pnpm cacert nodejs ];
    buildInputs = with pkgs; [ nodejs ];

    buildPhase = ''
      cp -r ${src} src
      chmod +w -R .
      cd src

      for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
        dir=$(realpath --relative-to="$PWD" "$absdir")
        rm -rf $dir/node_modules
        ln -sf ${node_modules}/$dir/node_modules $dir/node_modules
      done

      cd ${submodule}

      pnpm build
    '';

    installPhase = ''
      mkdir -p $out
      cp -r dist $out/dist
    '';
  };
}



