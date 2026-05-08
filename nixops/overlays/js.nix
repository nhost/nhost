(
  final: prev:
  let
    biome_version = "2.4.2";
    biome_dist = {
      aarch64-darwin = {
        url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-darwin-arm64";
        sha256 = "1qjmbnw0v000d6qgfa8rgicra9sq737w555s2l0n4phkp465yyqw";
      };
      x86_64-darwin = {
        url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-darwin-x64";
        sha256 = "05jjj2nw0fziiagcahw29lr6km3dlcpjjl5rnv2y16r067288srl";
      };
      aarch64-linux = {
        url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-linux-arm64";
        sha256 = "116mddjdy8m23mc0i7g51qv2g0lcfhwzg13g189gnqwg3isb99qy";
      };
      x86_64-linux = {
        url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-linux-x64";
        sha256 = "10pr2ymh7846karlswy9xnd24pfv6p4bjcm2azmii3pczv2shnh2";
      };
    };
  in
  rec {
    nodejs-slim_24 = prev.nodejs-slim_24.overrideAttrs (oldAttrs: rec {
      version = "24.14.1";
      src = prev.fetchurl {
        url = "https://nodejs.org/dist/v${version}/node-v${version}.tar.xz";
        sha256 = "sha256-eCJQdxPyAs8qVRiZ0lAllkP0d7ZxcG20Iab7VcSqCZE=";
      };
    });

    nodejs = final.symlinkJoin {
      name = "nodejs";
      version = final.nodejs-slim_24.version;
      paths = [
        final.nodejs-slim_24
        npm_11
      ];

      passthru = {
        inherit (final.nodejs-slim_24)
          version
          python
          meta
          src
          ;
      };
    };

    nodePackages = {
      inherit (final)
        eslint
        node-gyp
        node-gyp-build
        pnpm
        typescript
        typescript-language-server
        ;
      vercel =
        (import ./vercel {
          pkgs = final;
          nodejs = final.nodejs;
        })."vercel-50.9.5";
    };

    buildNpmPackage = prev.buildNpmPackage.override {
      nodejs = prev.nodejs;
    };

    npm_11 = final.stdenv.mkDerivation rec {
      pname = "npm";
      version = "11.7.0";
      src = final.fetchurl {
        url = "https://registry.npmjs.org/npm/-/npm-${version}.tgz";
        sha256 = "sha256-KS8ULcGowBGZujSgflfPAWwmDqLFm2Tz7uiqrnoudQQ=";
      };
      nativeBuildInputs = [ final.nodejs-slim_24 ];
      dontBuild = true;
      installPhase = ''
        mkdir -p $out/lib/node_modules/npm
        cp -r . $out/lib/node_modules/npm
        mkdir -p $out/bin
        ln -s $out/lib/node_modules/npm/bin/npm-cli.js $out/bin/npm
        ln -s $out/lib/node_modules/npm/bin/npx-cli.js $out/bin/npx
        patchShebangs $out/lib/node_modules/npm/bin
      '';
    };

    pnpm = (
      final.callPackage "${final.path}/pkgs/development/tools/pnpm/generic.nix" {
        version = "10.26.0";
        hash = "sha256-9gl0xoz+ChP5UfugGZZpWIV38OPwybfRp8pHYzv3I4Y=";
      }
    );

    ell = prev.ell.overrideAttrs (oldAttrs: {
      doCheck = false;
    });

    biome = final.stdenv.mkDerivation {
      pname = "biome";
      version = biome_version;

      src = final.fetchurl {
        inherit
          (biome_dist.${final.stdenvNoCC.hostPlatform.system}
            or (throw "Unsupported system: ${final.stdenvNoCC.hostPlatform.system}")
          )
          url
          sha256
          ;
      };

      dontUnpack = true;

      installPhase = ''
        mkdir -p $out/bin
        cp $src $out/bin/biome
        chmod +x $out/bin/biome
      '';
    };

  }
)
