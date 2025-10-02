final: prev:
{
  certbot-full = prev.certbot.overrideAttrs (old: {
    doCheck = false;
  });

  nhost-cli = final.callPackage ./nhost-cli.nix { inherit final; };
}
// import ./go.nix final prev
// import ./js.nix final prev
  // import ./postgres.nix final prev
