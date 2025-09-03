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
      ".gitignore"
      ".npmrc"
      "audit-ci.jsonc"
      "biome.json"
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
      mkdir -p $TMPDIR/home
      export HOME=$TMPDIR/home

      chmod +w -R .

      for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
        dir=$(realpath --relative-to="$PWD" "$absdir")
        cp -r ${node_modules}/$dir/node_modules $dir/node_modules
      done

      mkdir -p packages/nhost-js
      cp -r ${self.packages.${pkgs.system}.nhost-js}/dist packages/nhost-js/dist

      cd ${submodule}
      pnpm build
    '';

    installPhase = ''
      mkdir -p $out
    '';
  };
}



