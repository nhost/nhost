{ pkgs, nix2containerPkgs }:
let
  jsCheckDeps = with pkgs; [
    pnpm
    cacert
    nodejs
    biome
  ];

  mkNodeModules =
    { src
    , name
    , version
    , preBuild ? ""
    , pnpmOpts ? ""
    }:
    pkgs.stdenv.mkDerivation {
      inherit name version src;

      dontFixup = true;

      nativeBuildInputs = with pkgs; [
        pnpm
        cacert
        nodejs
      ];

      buildPhase = ''
        export HOME=$TMPDIR/home
        mkdir -p $HOME

        ${preBuild}

        pnpm install --frozen-lockfile ${pnpmOpts}
      '';

      installPhase = ''
        mkdir -p $out

        for absdir in $(pnpm list --recursive --depth=-1 --parseable); do
          dir=$(realpath --relative-to="$PWD" "$absdir")
          echo "  ➜ Copying node_modules for $dir"
          mkdir -p $out/$dir
          cp -r $dir/node_modules $out/$dir/node_modules
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
          echo "  ➜ Copying node_modules for $dir"
          cp -r ${node_modules}/$dir/node_modules $dir/node_modules

          echo "  ➜ Running pnpm audit-ci for $dir"
          pnpm audit-ci --directory $dir

        done

        ${preCheck}

        echo "➜ Running pnpm generate and checking sha1sum of all files"

        # Generate baseline checksums from the original filtered src
        find . -type f ! -path "*/node_modules/*" ! -path "./deprecated/*" -print0 | xargs -0 sha1sum > $TMPDIR/baseline

        # Copy and run generate
        pnpm run --dir ${submodule} generate

        # Check only files that existed in the baseline
        sha1sum -c $TMPDIR/baseline || (echo "❌ ERROR: pnpm generate changed files" && exit 1)


        echo "➜ Running linters and tests"
        pnpm run --dir ${submodule} test

        ${extraCheck}

        mkdir $out
      '';
in
{
  inherit mkNodeModules devShell check;
}
