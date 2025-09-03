{ pkgs, nix2containerPkgs }:
let
  jsCheckDeps = with pkgs; [
    pnpm_10
    cacert
    nodejs
    biome
    playwright-driver
  ];

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
      ];

      buildPhase = ''
        export HOME=$TMPDIR/home
        mkdir -p $HOME

        # Fix the workspace linking issue
        pnpm config set link-workspace-packages false
        pnpm install --frozen-lockfile
      '';

      installPhase = ''
        mkdir -p $out
        cp pnpm-lock.yaml $out/pnpm-lock.yaml

        for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
          dir=$(realpath --relative-to="$PWD" "$absdir")
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

      buildInputs = jsCheckDeps ++ buildInputs;

      shellHook = ''
        CUR_DIR=$(pwd)
        PRJ_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
        cd "$PRJ_ROOT"

        rm -rf node_modules
        ln -sf ${node_modules}/node_modules node_modules

        for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
          dir=$(realpath --relative-to="$PWD" "$absdir")
          rm -rf $dir/node_modules
          ln -sf ${node_modules}/$dir/node_modules $dir/node_modules
        done

        cd "$CUR_DIR"

        export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
        export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true

        ${shellHook}
      '';
    };

  check =
    { src
    , node_modules
    , submodule ? ""
    , buildInputs
    , nativeBuildInputs
    , checkDeps ? [ ]
    , preCheck ? ""
    , extraCheck ? ""
    }: pkgs.runCommand "jstests"
      {
        nativeBuildInputs = jsCheckDeps ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
      }
      ''
        cp -r ${src} src
        chmod +w -R .

        echo "➜ Source: ${src}"
        echo "➜ Workdir: $(realpath src)"
        echo "➜ Setting up node_modules and checking dependencies for security issues"
        cd src

        for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
          dir=$(realpath --relative-to="$PWD" "$absdir")
          cp -r ${node_modules}/$dir/node_modules $dir/node_modules
        done

        pnpm audit-ci

        ${preCheck}

        echo "➜ Running pnpm generate and checking sha1sum of all files"
        SRCROOT=$PWD

        # Generate baseline checksums from the original filtered src
        find . -type f ! -path "./node_modules/*" ! -path "./deprecated/*" -print0 | xargs -0 sha1sum > $TMPDIR/baseline

        # Copy and run generate
        cp -r ../src $TMPDIR/generate
        cd $TMPDIR/generate
        pnpm run --dir ${submodule} generate

        # Check only files that existed in the baseline
        sha1sum -c $TMPDIR/baseline || (echo "❌ ERROR: pnpm generate changed files" && exit 1)

        cd $SRCROOT

        echo "➜ Running linters and tests"
        pnpm run --dir ${submodule} test

        ${extraCheck}

        mkdir $out
      '';
in
{
  inherit mkNodeModules devShell check;
}
