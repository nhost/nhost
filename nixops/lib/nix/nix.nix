{ pkgs }:
let
  goCheckDeps = with pkgs; [
    go
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
        nativeBuildInputs = with pkgs; [
          nixfmt-rfc-style
        ];
      }
      ''
        nixfmt --check ${src}/*

        mkdir $out
      '';
}
