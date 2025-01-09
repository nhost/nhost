(final: prev: rec {
  nodejs = final.nodejs-18_x;
  nodePackages = nodejs.pkgs;
  nhost-cli = final.callPackage ./nhost-cli.nix { inherit final; };
})
