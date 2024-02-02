(final: prev: rec {
  nhost-cli = import ./nhost-cli.nix { inherit final prev; };

  nodejs = final.nodejs-18_x;
  nodePackages = nodejs.pkgs;
})
