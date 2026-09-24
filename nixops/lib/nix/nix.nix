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
  # lives under `pkgs.nhost.*` (see nixops/overlays/). The overlay may export
  # only `nhost`; another top-level attr could shadow nixpkgs build inputs
  # (go, nodejs, rustc, ...), tainting packages and defeating cache.nixos.org.
  # References to nixpkgs attrs that `pkgs.nhost.*` shadows must go through the
  # namespace, or they silently resolve to nixpkgs' unpinned versions.
  checkPinnedToolchains =
    {
      src,
      overlay,
    }:
    let
      l = pkgs.lib // builtins;
      overlayResult = overlay pkgs pkgs;
      overlayAttrs = l.attrNames overlayResult;
      unexpectedAttrs = l.subtractLists [ "nhost" ] overlayAttrs;
      missingAttrs = l.subtractLists overlayAttrs [ "nhost" ];

      # Names provided under `pkgs.nhost.*` that also exist as top-level
      # nixpkgs attrs: a bare `pkgs.<name>` reference silently picks the
      # unpinned nixpkgs version, so grep for those. Names with no nixpkgs
      # counterpart fail evaluation loudly on their own.
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
      ${l.optionalString (unexpectedAttrs != [ ] || missingAttrs != [ ]) ''
        echo "Nhost overlay must export only nhost:" >&2
        ${l.optionalString (unexpectedAttrs != [ ]) ''
          echo "unexpected attrs:" >&2
          printf '  %s\n' ${l.escapeShellArgs unexpectedAttrs} >&2
        ''}
        ${l.optionalString (missingAttrs != [ ]) ''
          echo "missing required attrs:" >&2
          printf '  %s\n' ${l.escapeShellArgs missingAttrs} >&2
        ''}
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
