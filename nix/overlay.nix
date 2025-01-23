(final: prev: rec {
  nodejs = final.nodejs_20;
  nodePackages = nodejs.pkgs;
  nhost-cli = final.callPackage ./nhost-cli.nix { inherit final; };
})
