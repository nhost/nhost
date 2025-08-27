{ self, pkgs, nix-filter, nixops-lib, mkNodeDevShell, node_modules }:
let
  name = "nhost-js";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "packages/${name}";

  src = nix-filter.lib.filter {
    root = ../..;
    include = with nix-filter.lib; [
      isDirectory
      (matchName "package.json")
      ".npmrc"
      "audit-ci.jsonc"
      "pnpm-workspace.yaml"
      "pnpm-lock.yaml"
      "turbo.json"
      (inDirectory "./build")
      "${submodule}/.prettierignore"
      "${submodule}/eslint.config.js"
      "${submodule}/gen.sh"
      "${submodule}/jest.config.js"
      "${submodule}/tsconfig.eslint.json"
      "${submodule}/tsconfig.json"
      "${submodule}/typedoc.json"
      "${submodule}/typedoc.sh"
      "${submodule}/vite.config.ts"
      "${submodule}/vite.umd.config.ts"
      (inDirectory "${submodule}/api")
      (inDirectory "${submodule}/src")
    ];
  };

  checkDeps = with pkgs; [ nhost-cli ];

  buildInputs = with pkgs; [ nodejs ];

  nativeBuildInputs = with pkgs; [ pnpm cacert ];
in
{
  devShell = mkNodeDevShell {
    buildInputs = with pkgs;[
      nodePackages.vercel
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  check = pkgs.runCommand "check"
    {
      nativeBuildInputs = checkDeps ++ buildInputs ++ nativeBuildInputs;
    } ''
    cp -r ${src}/* .
    chmod +w -R .

    cp -r ${node_modules}/node_modules/ node_modules
    cp -r ${node_modules}/${submodule}/node_modules/ ${submodule}/node_modules

    export HOME=$TMPDIR

    echo "➜ Checking dependencies for security issues"
    pnpm audit-ci

    cd ${submodule}

    echo "➜ Running linters and tests"
    pnpm test

    mkdir -p $out
  '';


  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [ pnpm cacert nodejs ];
    buildInputs = with pkgs; [ nodejs ];

    buildPhase = ''
      cp -r ${src}/* .
      chmod +w -R .

      cp -r ${node_modules}/node_modules/ node_modules
      cp -r ${node_modules}/${submodule}/node_modules/ ${submodule}/node_modules

      pnpm build
    '';

    installPhase = ''
      mkdir -p $out
      cp -r dist $out/dist
    '';
  };
}

