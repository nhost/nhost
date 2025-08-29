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
    { src
    }:
    pkgs.runCommand "check-nixpkgs-fmt"
      {
        nativeBuildInputs = with pkgs;
          [
            nixpkgs-fmt
          ];
      }
      ''
        nixpkgs-fmt --check ${src}/*

        mkdir $out
      '';
}
