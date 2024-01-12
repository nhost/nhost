(final: prev: rec {
  nhost-cli = import ./nhost-cli.nix { inherit final prev; };

  nodejs = final.nodejs-18_x;
  nodePackages = nodejs.pkgs;

  mintlify = (final.callPackage ./mintlify/default.nix { }).package.overrideAttrs (old: {
    postInstall = ''
      find $out
      ln -sf $out/lib/node_modules/mintlify/node_modules/.bin/mintlify $out/bin/mintlify
    '';
  });
})
