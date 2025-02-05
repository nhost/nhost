(final: prev: rec {
  nodejs = final.nodejs_20;
  nodePackages = nodejs.pkgs;
  nhost-cli = final.callPackage ./nhost-cli.nix { inherit final; };

  pnpm_10 = final.callPackage "${final.path}/pkgs/development/tools/pnpm/generic.nix" {
    version = "10.1.0";
    hash = "sha256-PuU+kUAR7H8abjqwxYuaAkoFK/4YKVsjtoVn1qal680=";
  };
})
