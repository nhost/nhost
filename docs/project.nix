{ self, pkgs, nix-filter, mkNodeDevShell, node_modules }:
let
  name = "docs";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "packages/${name}";

  src = nix-filter.lib.filter {
    root = ../..;
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
    ];
  };

  checkDeps = [ self.packages.${pkgs.system}.mintlify-openapi ];

  buildInputs = with pkgs; [ nodejs ];

  nativeBuildInputs = with pkgs; [ pnpm cacert ];
in
{
  devShell = mkNodeDevShell {
    buildInputs = [
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  check = pkgs.runCommand "check"
    {
      nativeBuildInputs = checkDeps ++ buildInputs ++ nativeBuildInputs;
    } ''
    cp -r ${src} src
    chmod +w -R .
    cd src

    cp -r ${node_modules}/node_modules/ node_modules
    cp -r ${node_modules}/${submodule}/node_modules/ ${submodule}/node_modules

    echo "➜ Checking dependencies for security issues"
    pnpm audit-ci

    cd ${submodule}

    echo "➜ Running linters and tests"
    pnpm test

    mkdir -p $out
  '';
}

