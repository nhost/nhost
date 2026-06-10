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

  # Guard against reintroducing the unpinned toolchains: bare `go`/`nodejs`
  # resolve to nixpkgs' versions and silently swap out the pinned ones (use
  # `go-pinned`/`nodejs-pinned` instead). Worse, re-overriding the global
  # attrs in an overlay taints every nixpkgs package that builds with them,
  # defeating cache.nixos.org. See nixops/overlays/{go,js}.nix.
  checkPinnedToolchains =
    {
      src,
    }:
    pkgs.runCommand "check-pinned-toolchains" { } ''
      pattern='^[[:space:]]*(go|nodejs)[[:space:]]*$|pkgs\.(go|nodejs)([^-_a-zA-Z0-9.]|$)|\[[[:space:]]*(go|nodejs)[[:space:]]*\]'

      # vercel/node-env.nix and functions/project.nix take `nodejs` as a
      # function argument (fed nodejs-pinned / the stock node runtime images).
      matches=$(grep -rnE --include='*.nix' -e "$pattern" ${src} \
        | grep -vE '/nixops/overlays/vercel/|/services/functions/project\.nix:' \
        || true)

      if [ -n "$matches" ]; then
        echo "unpinned go/nodejs references found; use go-pinned / nodejs-pinned:" >&2
        echo "$matches" >&2
        exit 1
      fi

      mkdir $out
    '';
}
