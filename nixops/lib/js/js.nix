{ pkgs, nix2containerPkgs }:
let
  mkNodeModules =
    { src
    , name
    , version
    }:
    pkgs.stdenv.mkDerivation {
      inherit name version src;

      nativeBuildInputs = with pkgs; [
        pnpm_10
        cacert
        nodejs
        findutils
      ];

      buildPhase = ''
        pnpm --version
        pnpm install --frozen-lockfile
      '';

      installPhase = ''
        mkdir -p $out
        cp pnpm-lock.yaml $out/pnpm-lock.yaml

        find . -name package.json -not -path "./node_modules/*" -not -path "./.git/*" | while read -r packagejson; do
          dir=$(dirname "$packagejson")
          mkdir -p $out/$dir
          cp -r $dir/node_modules $out/$dir/node_modules
          cp $dir/package.json $out/$dir/package.json
        done
      '';
    };

  devShell =
    { node_modules
    , buildInputs ? [ ]
    , shellHook ? ""
    }: pkgs.mkShell {

      buildInputs = with pkgs; [
        nodejs
        pnpm_10
        playwright-driver
      ] ++ buildInputs;

      shellHook = ''
        CUR_DIR=$(pwd)
        PRJ_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
        cd "$PRJ_ROOT"

        rm -rf node_modules
        ln -sf ${node_modules}/node_modules node_modules

        find . -name package.json -not -path "./node_modules/*" -not -path "./.git/*" | while read -r packagejson; do
          dir=$(dirname "$packagejson")
          rm -rf $dir/node_modules
          ln -sf ${node_modules}/$dir/node_modules $dir/node_modules
        done

        cd "$CUR_DIR"

        export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
        export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true

        ${shellHook}
      '';
    };
in
{
  inherit mkNodeModules devShell;
}

