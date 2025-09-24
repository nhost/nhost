(final: prev: rec {
  nodejs = final.nodejs_20;
  nodePackages = nodejs.pkgs;

  pnpm_10 = final.callPackage "${final.path}/pkgs/development/tools/pnpm/generic.nix" {
    version = "10.1.0";
    hash = "sha256-PuU+kUAR7H8abjqwxYuaAkoFK/4YKVsjtoVn1qal680=";
  };

  ell = prev.ell.overrideAttrs (oldAttrs: {
    doCheck = false;
  });

  biome = prev.biome.overrideAttrs (finalAttrs: prevAttrs: rec {
    pname = "biome";
    version = "2.2.2";

    src = final.fetchFromGitHub {
      owner = "biomejs";
      repo = "biome";
      rev = "@biomejs/biome@${version}";
      hash = "sha256-YmDHAsNGN5lsCgiciASdMUM6InbbjaGwyfyEX+XNOxs=";
    };

    cargoHash = "sha256-l3BQMG/cCxzQizeFGwAEDP8mzLtf/21ojyd+7gzhbtU=";

    cargoDeps = final.rustPlatform.fetchCargoVendor {
      inherit (finalAttrs) pname src version;
      hash = finalAttrs.cargoHash;
    };
  });
})

