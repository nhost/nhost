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
  # lives under `pkgs.nhost.*` (see nixops/overlays/). The overlay must not
  # export anything else — shadowing global nixpkgs attrs (go, nodejs, ...)
  # taints every nixpkgs package that builds with them, defeating
  # cache.nixos.org. And references to nixpkgs attrs that `pkgs.nhost.*`
  # shadows must go through the namespace, or they silently resolve to
  # nixpkgs' unpinned versions.
  checkPinnedToolchains =
    {
      src,
    }:
    let
      l = pkgs.lib // builtins;

      # flake.nix wires (only) this composed overlay into nixpkgs, so an
      # overlay file not reachable from it cannot taint anything. Overlays are
      # plain functions: applying one and inspecting its attr names is exact,
      # and laziness keeps it cheap (no attr values are forced).
      overlayFile = "${src}/nixops/overlays/default.nix";

      overlayAttrs = l.optionals (l.pathExists overlayFile) (l.attrNames (import overlayFile pkgs pkgs));

      overlayViolations = l.remove "nhost" overlayAttrs;

      # Names provided under `pkgs.nhost.*` that also exist as top-level
      # nixpkgs attrs: a bare `pkgs.<name>` reference silently picks the
      # unpinned nixpkgs version, so grep for those. Names with no nixpkgs
      # counterpart (nhost-cli, npm_11, ...) fail evaluation loudly on their
      # own.
      shadowedNames = l.optionals (l.elem "nhost" overlayAttrs) (
        l.intersectLists (l.attrNames (import overlayFile pkgs pkgs).nhost) (l.attrNames pkgs)
      );

      namesAlt = l.concatStringsSep "|" shadowedNames;

      pattern = l.concatStringsSep "|" [
        "^[[:space:]]*(${namesAlt})[[:space:]]*$"
        "(pkgs|final)\\.(${namesAlt})([^-_a-zA-Z0-9.]|$)"
        "\\[[[:space:]]*(${namesAlt})[[:space:]]*\\]"
      ];
    in
    pkgs.runCommand "check-pinned-toolchains" { } ''
      ${l.optionalString (overlayViolations != [ ]) ''
        echo "the nixpkgs overlay must only export the nhost namespace; found extra attrs:" >&2
        printf '  %s\n' ${l.escapeShellArgs overlayViolations} >&2
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
