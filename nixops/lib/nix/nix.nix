{ pkgs }:
let
  goCheckDeps = with pkgs; [
    go-pinned
    clang
    golangci-lint
    richgo
    golines
    gofumpt
    govulncheck
  ];
in
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

  # Guard against reintroducing the unpinned toolchains/builders: bare
  # `go`/`nodejs`/`buildGoModule` resolve to nixpkgs' versions and silently
  # swap out the pinned ones (use `go-pinned`/`nodejs-pinned`/
  # `buildGoModule-pinned` instead). Worse, re-exporting the global attrs from
  # the overlay taints every nixpkgs package that builds with them, defeating
  # cache.nixos.org. See nixops/overlays/{go,js}.nix.
  checkPinnedToolchains =
    {
      src,
    }:
    let
      l = pkgs.lib // builtins;

      # Global toolchain/builder attrs the overlay must never export.
      forbiddenOverlayAttrs = [
        "buildGoModule"
        "buildNpmPackage"
        "go"
        "nodejs"
        "nodejs-slim_24"
      ];

      # flake.nix wires (only) this composed overlay into nixpkgs, so an
      # overlay file not reachable from it cannot taint anything. Overlays are
      # plain functions: applying one and inspecting its attr names is exact,
      # and laziness keeps it cheap (no attr values are forced).
      overlayFile = "${src}/nixops/overlays/default.nix";

      overlayViolations = l.optionals (l.pathExists overlayFile) (
        l.intersectLists forbiddenOverlayAttrs (l.attrNames (import overlayFile pkgs pkgs))
      );
    in
    pkgs.runCommand "check-pinned-toolchains" { } ''
      ${l.optionalString (overlayViolations != [ ]) ''
        echo "the nixpkgs overlay exports global toolchain attrs; export *-pinned names instead:" >&2
        printf '  %s\n' ${l.escapeShellArgs overlayViolations} >&2
        exit 1
      ''}

      pattern='^[[:space:]]*(go|nodejs|buildGoModule)[[:space:]]*$|(pkgs|final)\.(go|nodejs|buildGoModule)([^-_a-zA-Z0-9.]|$)|\[[[:space:]]*(go|nodejs|buildGoModule)[[:space:]]*\]'

      # vercel/node-env.nix is generated node2nix code wired by the overlay
      # with nodejs-pinned; its internals intentionally still name the
      # parameter `nodejs`.
      matches=$(grep -rnE --include='*.nix' -e "$pattern" ${src} \
        | grep -vE '/nixops/overlays/vercel/' \
        || true)

      if [ -n "$matches" ]; then
        echo "unpinned go/nodejs/buildGoModule references found; use go-pinned / nodejs-pinned / buildGoModule-pinned:" >&2
        echo "$matches" >&2
        exit 1
      fi

      mkdir $out
    '';
}
