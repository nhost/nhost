(final: prev:
let
  biome_version = "2.3.11";
  biome_dist = {
    aarch64-darwin = {
      url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-darwin-arm64";
      sha256 = "0arxr9ghdkg0xnq11fnj0klnwllh7s56pjnw591fs989yj7wh3sh";
    };
    x86_64-darwin = {
      url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-darwin-x64";
      sha256 = "1fpm6nkfypbq46va1mi8ybfqp75bhkp6b16np1gdn4kc2hqxzx90";
    };
    aarch64-linux = {
      url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-linux-arm64";
      sha256 = "0y2mab4ggz4w9wj5f5j7h47hpzzx0jfm6a2z3s609b5bmnqf8v03";
    };
    x86_64-linux = {
      url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-linux-x64";
      sha256 = "0rwfwksvbdawrpgcd7r52w8vzp7lz224inqzmgwcncrf22n7yn4j";
    };
  };
in
rec{
  nodejs = final.symlinkJoin {
    name = "nodejs";
    version = final.nodejs-slim_20.version;
    paths = [ final.nodejs-slim_20 npm_11 ];

    passthru = {
      inherit (final.nodejs-slim_20) version python meta src;

      pkgs = final.callPackage "${final.path}/pkgs/development/node-packages/default.nix" {
        nodejs = final.nodejs;
      };
    };
  };

  nodePackages = prev.nodejs.pkgs;

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
    dontBuild = true;
    installPhase = ''
      mkdir -p $out/lib/node_modules/npm
      cp -r . $out/lib/node_modules/npm
      mkdir -p $out/bin
      ln -s $out/lib/node_modules/npm/bin/npm-cli.js $out/bin/npm
      ln -s $out/lib/node_modules/npm/bin/npx-cli.js $out/bin/npx
    '';
  };

  pnpm = (final.callPackage "${final.path}/pkgs/development/tools/pnpm/generic.nix" {
    version = "10.26.0";
    hash = "sha256-9gl0xoz+ChP5UfugGZZpWIV38OPwybfRp8pHYzv3I4Y=";
  });

  ell = prev.ell.overrideAttrs (oldAttrs: {
    doCheck = false;
  });

  biome = final.stdenv.mkDerivation {
    pname = "biome";
    version = biome_version;

    src = final.fetchurl {
      inherit (biome_dist.${final.stdenvNoCC.hostPlatform.system} or
        (throw "Unsupported system: ${final.stdenvNoCC.hostPlatform.system}")) url sha256;
    };

    dontUnpack = true;

    installPhase = ''
      mkdir -p $out/bin
      cp $src $out/bin/biome
      chmod +x $out/bin/biome
    '';
  };

})
