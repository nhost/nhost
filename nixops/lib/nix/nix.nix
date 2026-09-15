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
  # lives under `pkgs.nhost.*` (see nixops/overlays/). flake.nix declares each
  # applied overlay together with its permitted top-level API. Any undeclared
  # top-level attr could shadow nixpkgs build inputs (go, nodejs, rustc, ...),
  # tainting every package that uses them and defeating cache.nixos.org.
  # References to nixpkgs attrs that `pkgs.nhost.*` shadows must go through the
  # namespace, or they silently resolve to nixpkgs' unpinned versions.
  checkPinnedToolchains =
    {
      src,
      overlay,
      overlayComponents,
    }:
    let
      l = pkgs.lib // builtins;

      # Check each component independently to retain attribution. A composite
      # allowlist is necessarily the union of every component's allowlist, so
      # it cannot detect one component exporting an attr owned by another.
      # Applying the functions and inspecting their attr names is exact, and
      # laziness keeps it cheap.
      componentSurfaces = l.map (
        component:
        let
          actualAttrs = l.attrNames (component.overlay pkgs pkgs);
        in
        {
          inherit (component) allowedAttrs name;
          missingAttrs = l.subtractLists actualAttrs (component.requiredAttrs or [ ]);
          unexpectedAttrs = l.subtractLists component.allowedAttrs actualAttrs;
        }
      ) overlayComponents;

      componentViolations = l.filter (
        component: component.missingAttrs != [ ] || component.unexpectedAttrs != [ ]
      ) componentSurfaces;

      # Also check the literal applied surface. Components in a composition see
      # an incrementally extended `prev`, unlike the independent checks above,
      # and may therefore expose additional, prev-dependent names.
      allowedOverlayAttrs = l.unique (l.concatMap (component: component.allowedAttrs) overlayComponents);
      overlayResult = overlay pkgs pkgs;
      overlayAttrs = l.attrNames overlayResult;
      composedViolations = l.subtractLists allowedOverlayAttrs overlayAttrs;

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
      ${l.optionalString (componentViolations != [ ]) ''
        ${l.concatStringsSep "\n" (
          l.map (component: ''
            echo ${l.escapeShellArg "${component.name} overlay surface violates its declaration:"} >&2
            ${l.optionalString (component.unexpectedAttrs != [ ]) ''
              echo "unexpected attrs:" >&2
              printf '  %s\n' ${l.escapeShellArgs component.unexpectedAttrs} >&2
            ''}
            ${l.optionalString (component.missingAttrs != [ ]) ''
              echo "missing required attrs:" >&2
              printf '  %s\n' ${l.escapeShellArgs component.missingAttrs} >&2
            ''}
          '') componentViolations
        )}
        exit 1
      ''}

      ${l.optionalString (composedViolations != [ ]) ''
        echo "the composed nixpkgs overlay exports attrs from no declared component:" >&2
        printf '  %s\n' ${l.escapeShellArgs composedViolations} >&2
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
