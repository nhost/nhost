{ pkgs }:
{
  check =
    {
      src,
    }:
    pkgs.runCommand "check-nixfmt"
      {
        __noChroot = true;
        nativeBuildInputs = with pkgs; [
          nixfmt
        ];
      }
      ''
        find ${src} -name '*.nix' -exec nixfmt --check {} +

        mkdir $out
      '';

  # Guard against reintroducing unpinned toolchains: everything Nhost pins
  # lives under `pkgs.nhost.*` (see nixops/overlays/). flake.nix also composes
  # rust-overlay, whose stable API is explicitly allowlisted below. Any other
  # Nhost top-level attr could shadow nixpkgs build inputs (go, nodejs, rustc,
  # ...), tainting every package that uses them and defeating cache.nixos.org.
  # References to nixpkgs attrs that `pkgs.nhost.*` shadows must go through the
  # namespace, or they silently resolve to nixpkgs' unpinned versions.
  checkPinnedToolchains =
    {
      src,
      overlay,
      nhostOverlay,
      rustOverlay,
    }:
    let
      l = pkgs.lib // builtins;

      # Check each component independently so an attr allowed for rust-overlay
      # cannot hide an accidental top-level export from the Nhost overlay.
      # Applying the functions and inspecting their attr names is exact, and
      # laziness keeps it cheap.
      nhostOverlayAttrs = l.attrNames (nhostOverlay pkgs pkgs);
      rustOverlayAttrs = l.attrNames (rustOverlay pkgs pkgs);

      allowedRustOverlayAttrs = [
        "latest"
        "lib"
        "rust-bin"
        "rustChannelOf"
        "rustChannelOfTargets"
        "rustChannels"
      ];

      rustOverlayViolations = l.filter (name: !(l.elem name allowedRustOverlayAttrs)) rustOverlayAttrs;

      # Inspect the composed overlay for the namespace members whose use must
      # be checked across the repository.
      overlayResult = overlay pkgs pkgs;
      overlayAttrs = l.attrNames overlayResult;

      # Names provided under `pkgs.nhost.*` that also exist as top-level
      # nixpkgs attrs: a bare `pkgs.<name>` reference silently picks the
      # unpinned nixpkgs version, so grep for those. Names with no nixpkgs
      # counterpart (nhost-cli, npm_11, ...) fail evaluation loudly on their
      # own.
      shadowedNames = l.optionals (l.elem "nhost" overlayAttrs) (
        l.intersectLists (l.attrNames overlayResult.nhost) (l.attrNames pkgs)
      );

      namesAlt = l.concatStringsSep "|" shadowedNames;

      pattern = l.concatStringsSep "|" [
        "^[[:space:]]*(${namesAlt})[[:space:]]*$"
        "(pkgs|final)\\.(${namesAlt})([^-_a-zA-Z0-9.]|$)"
        "\\[[[:space:]]*(${namesAlt})[[:space:]]*\\]"
      ];
    in
    pkgs.runCommand "check-pinned-toolchains" { } ''
      ${l.optionalString (nhostOverlayAttrs != [ "nhost" ]) ''
        echo "the Nhost nixpkgs overlay must export exactly the nhost namespace; found:" >&2
        printf '  %s\n' ${l.escapeShellArgs nhostOverlayAttrs} >&2
        exit 1
      ''}

      ${l.optionalString (rustOverlayViolations != [ ]) ''
        echo "rust-overlay exports unexpected attrs:" >&2
        printf '  %s\n' ${l.escapeShellArgs rustOverlayViolations} >&2
        exit 1
      ''}

      ${l.optionalString (shadowedNames != [ ]) ''
        pattern='${pattern}'

        # vercel/node-env.nix is generated node2nix code wired by the overlay
        # with the pinned node; its internals intentionally still name the
        # parameter `nodejs`. vendor/ is third-party code.
        matches=$(grep -rnE --include='*.nix' -e "$pattern" ${src} \
          | grep -vE '/nixops/overlays/vercel/|/vendor/' \
          || true)

        if [ -n "$matches" ]; then
          echo "references to nixpkgs attrs shadowed by pkgs.nhost.* found; use pkgs.nhost.<name>:" >&2
          echo "$matches" >&2
          exit 1
        fi
      ''}

      mkdir $out
    '';
}
