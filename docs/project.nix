{ self, pkgs, nixops-lib, nix-filter, node_modules }:
let
  name = "docs";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "${name}";

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

  check = pkgs.runCommand "check"
    {
      nativeBuildInputs = checkDeps ++ buildInputs ++ nativeBuildInputs;
    } ''
    cp -r ${src} src
    chmod +w -R .

    cp -r ${node_modules}/node_modules/ src/node_modules
    cp -r ${node_modules}/${submodule}/node_modules/ src/${submodule}/node_modules
    cp -r ${node_modules}/packages/nhost-js/node_modules/ src/packages/nhost-js/node_modules

    echo "➜ Checking dependencies for security issues"
    cd src
    pnpm audit-ci
    cd ..

    echo "➜ Running pnpm generate and checking sha1sum of all files"
    SRCROOT=$PWD

    # Generate baseline checksums from the original filtered src
    cd src
    find . -type f ! -path "./node_modules/*" ! -path "./deprecated/*" -print0 | xargs -0 sha1sum > $TMPDIR/baseline

    # Copy and run generate
    cp -r ../src $TMPDIR/generate
    cd $TMPDIR/generate
    pnpm run --dir ${submodule} generate

    # Check only files that existed in the baseline
    sha1sum -c $TMPDIR/baseline || (echo "❌ ERROR: pnpm generate changed files" && exit 1)

    echo "➜ Running linters and tests"
    pnpm run --dir ${submodule} test

    mkdir -p $out
  '';
}
