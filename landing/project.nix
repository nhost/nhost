{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "landing";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "${name}";

  fs = pkgs.lib.fileset;

  node_modules = nixops-lib.js.mkNodeModules {
    name = "node-modules-${name}";
    version = "0.0.0-dev";

    src = fs.toSource {
      root = ../.;
      fileset = fs.unions [
        ../.npmrc
        ../package.json
        ../pnpm-workspace.yaml
        ../pnpm-lock.yaml
        ./package.json
        ./pnpm-lock.yaml
      ];
    };
  };

  src = fs.toSource {
    root = ../.;
    fileset = fs.unions [
      ../.npmrc
      ../.gitignore
      ../audit-ci.jsonc
      ../package.json
      ../pnpm-workspace.yaml
      ../pnpm-lock.yaml
      ../turbo.json
      ./.
    ];
  };

  buildInputs = with pkgs; [ nhost.nodejs ];

  nativeBuildInputs = with pkgs; [
    nhost.pnpm
    cacert
  ];

  vercelPrepare = ''
    cp -r ${node_modules}/node_modules/ node_modules
    cp -r ${node_modules}/landing/node_modules/ landing/node_modules
    chmod +w -R node_modules landing/node_modules
  '';
in
rec {
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs = [
    ]
    ++ buildInputs
    ++ nativeBuildInputs;
  };

  check = nixops-lib.js.check {
    inherit
      src
      node_modules
      submodule
      buildInputs
      nativeBuildInputs
      ;
  };

  vercelPreview = nixops-lib.js.mkVercel {
    inherit
      src
      node_modules
      buildInputs
      nativeBuildInputs
      ;
    name = "landing";
    environment = "preview";
    prepare = vercelPrepare;
  };

  vercelProduction = nixops-lib.js.mkVercel {
    inherit
      src
      node_modules
      buildInputs
      nativeBuildInputs
      ;
    name = "landing";
    environment = "production";
    prepare = vercelPrepare;
  };

  vercelBuildPreview = vercelPreview.build;
  vercelDeployPreview = vercelPreview.deploy;
  vercelBuildProduction = vercelProduction.build;
  vercelDeployProduction = vercelProduction.deploy;
}
