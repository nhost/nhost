{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "docs";
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
      ../biome.json
      ../package.json
      ../pnpm-workspace.yaml
      ../pnpm-lock.yaml
      ../turbo.json
      ../build
      ./.
      (fs.fileFilter (f: f.hasExt "ts") ../packages/nhost-js/src)
      ../services/auth/docs/openapi.yaml
      ../services/storage/controller/openapi.yaml
      ../packages/nhost-js/tsconfig.json
      ../build/configs/tsconfig/library.json
      ../build/configs/tsconfig/base.json
      # Go sources for gen.sh's configuration reference generator (tools/configdocs).
      ../go.mod
      ../go.sum
      ../tools/configdocs
      ../vendor/modules.txt
      ../vendor/cuelang.org/go
      ../vendor/github.com/cockroachdb/apd
      ../vendor/github.com/nhost/be/services/mimir/schema/schema.cue
    ];
  };

  checkDeps = with pkgs; [
    self.packages.${pkgs.stdenv.hostPlatform.system}.cli
    vale
  ];

  buildInputs = with pkgs; [
    nhost.nodejs
    nhost.go # used by gen.sh to generate the configuration reference from the CUE schema
  ];

  nativeBuildInputs = with pkgs; [
    nhost.pnpm
    cacert
  ];

  vercelPrepare = ''
    cp -r ${node_modules}/node_modules/ node_modules
    cp -r ${node_modules}/docs/node_modules/ docs/node_modules
    chmod +w -R node_modules docs/node_modules

    mkdir -p packages/nhost-js
    cp -r ${self.packages.${pkgs.stdenv.hostPlatform.system}.nhost-js}/dist packages/nhost-js/dist
    cp -r ${
      self.packages.${pkgs.stdenv.hostPlatform.system}.nhost-js
    }/node_modules packages/nhost-js/node_modules
    chmod +w -R packages
  '';
in
rec {
  devShell = nixops-lib.js.devShell {
    inherit node_modules;

    buildInputs = [
    ]
    ++ checkDeps
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
      checkDeps
      ;

    preCheck = ''
      mkdir -p packages/nhost-js
      cp -r ${self.packages.${pkgs.stdenv.hostPlatform.system}.nhost-js}/dist packages/nhost-js/dist
      cp -r ${
        self.packages.${pkgs.stdenv.hostPlatform.system}.nhost-js
      }/node_modules packages/nhost-js/node_modules

      # Stage the prebuilt rustdoc JSON where gen.sh's build_rustdoc expects it,
      # so it only runs the Node transformer (no cargo in the docs sandbox).
      mkdir -p packages/nhost-rust/target/doc
      cp ${
        self.packages.${pkgs.stdenv.hostPlatform.system}.nhost-rust-doc
      }/nhost.json packages/nhost-rust/target/doc/nhost.json
    '';
  };

  vercelPreview = nixops-lib.js.mkVercel {
    inherit
      src
      node_modules
      buildInputs
      nativeBuildInputs
      ;
    name = "docs";
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
    name = "docs";
    environment = "production";
    prepare = vercelPrepare;
  };

  vercelBuildPreview = vercelPreview.build;
  vercelDeployPreview = vercelPreview.deploy;
  vercelBuildProduction = vercelProduction.build;
  vercelDeployProduction = vercelProduction.deploy;
}
