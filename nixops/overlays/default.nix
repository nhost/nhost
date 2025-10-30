final: prev:
{
  certbot-full = prev.certbot.overrideAttrs (old: {
    doCheck = false;
  });

  linux-pam = prev.linux-pam.overrideAttrs (oldAttrs: {
    outputs = [ "out" ];

    postInstall = ''
      rm sbin/pam_namespace_helper
      rm etc/security/namespace.init
    '';
  });

  nhost-cli = final.callPackage ./nhost-cli.nix { inherit final; };
}
// import ./go.nix final prev
// import ./js.nix final prev
  // import ./postgres.nix final prev

