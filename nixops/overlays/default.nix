final: prev: {
  # Everything Nhost pins or builds from source lives under `pkgs.nhost.*`.
  # The overlay deliberately exports nothing else: shadowing global nixpkgs
  # attrs (go, nodejs, buildGoModule, ...) taints every nixpkgs package that
  # builds with them, defeating cache.nixos.org.
  # `nixops-lib.nix.checkPinnedToolchains` enforces this.
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
