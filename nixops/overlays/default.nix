final: prev: {
  # Everything Nhost pins or builds from source lives under `pkgs.nhost.*`.
  # This Nhost overlay deliberately exports nothing else. flake.nix composes
  # rust-overlay ahead of it to provide rust-bin and its compatibility aliases
  # without shadowing nixpkgs' Rust build inputs. Each component overlay's
  # top-level API is checked independently by
  # `nixops-lib.nix.checkPinnedToolchains`.
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
