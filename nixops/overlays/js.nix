(final: prev:
let
  biome_version = "2.2.4";
  biome_dist = {
    aarch64-darwin = {
      url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-darwin-arm64";
      sha256 = "1z0qb6a21qwk93gpqvfvi01w472fs982vn7hg5my1c0bandnmgy6";
    };
    x86_64-darwin = {
      url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-darwin-x64";
      sha256 = "1nx29wszaxnhs08gsljqw64z5hlbarnq6yvkvylh680q4nkirw93";
    };
    aarch64-linux = {
      url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-linux-arm64";
      sha256 = "1wy3za2h38ky358dac3jf3jhhqjqvz0x7cbqhc46j2821b8vr7i4";
    };
    x86_64-linux = {
      url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-linux-x64";
      sha256 = "1i63hawgaajnwadbhh3aq68kbgyvahk6px1iy096slcrbd423pid";
    };
  };
in
rec{

  nodejs = final.nodejs_20;
  nodePackages = nodejs.pkgs;

  pnpm_10 = final.callPackage "${final.path}/pkgs/development/tools/pnpm/generic.nix" {
    version = "10.1.0";
    hash = "sha256-PuU+kUAR7H8abjqwxYuaAkoFK/4YKVsjtoVn1qal680=";
  };

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
