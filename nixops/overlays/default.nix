final: prev:
{
  nhost-cli = final.callPackage ./nhost-cli.nix { inherit final; };

  certbot-full = prev.certbot.overrideAttrs (old: {
    doCheck = false;
  });
}
// import ./go.nix final prev
// import ./js.nix final prev
  // import ./postgres.nix final prev
