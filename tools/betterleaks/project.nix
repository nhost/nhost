{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "betterleaks";
  description = "betterleaks with the Nhost secret-scanning configuration baked in";
  version = pkgs.nhost.betterleaks.version;

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ./.;
    fileset = fs.unions [
      ./betterleaks.toml
      ./.betterleaksignore
      ./tests
    ];
  };

  package =
    pkgs.runCommand "${name}-${version}"
      {
        nativeBuildInputs = [ pkgs.makeWrapper ];
        meta = pkgs.nhost.betterleaks.meta // {
          inherit description;
        };
      }
      ''
        mkdir -p "$out/share/${name}"
        cp ${src}/betterleaks.toml "$out/share/${name}/betterleaks.toml"
        cp ${src}/.betterleaksignore "$out/share/${name}/.betterleaksignore"
        makeWrapper ${pkgs.nhost.betterleaks}/bin/betterleaks "$out/bin/betterleaks" \
          --set-default BETTERLEAKS_CONFIG "$out/share/${name}/betterleaks.toml" \
          --add-flags "--gitleaks-ignore-path $out/share/${name}/.betterleaksignore"
      '';
in
{
  check =
    pkgs.runCommand "check-${name}"
      {
        nativeBuildInputs = [
          package
          pkgs.jq
        ];
      }
      ''
        betterleaks config check
        for t in ${src}/tests/*.sh; do bash "$t"; done
        mkdir "$out"
      '';

  devShell = pkgs.mkShell {
    buildInputs = [
      package
      pkgs.jq
    ];
  };

  inherit package;
}
