final: prev: {
  # Everything Nhost pins or builds from source lives under `pkgs.nhost.*`.
  # This Nhost overlay deliberately exports nothing else; the nixops check
  # guards its top-level API against accidentally shadowing nixpkgs inputs.
  nhost = {
    certbot-full = prev.certbot.overrideAttrs (old: {
      doCheck = false;
    });

    nhost-cli = final.callPackage ./nhost-cli.nix { inherit final; };

    pi-agent = final.callPackage ./pi-agent.nix { inherit final; };
  }
  // import ./go.nix final prev
  // import ./js.nix final prev
  // import ./postgres.nix final prev;
}
