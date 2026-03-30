{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_squeeze";
  version = "1.9.1";

  src = pkgs.fetchFromGitHub {
    owner = "cybertec-postgresql";
    repo = "pg_squeeze";
    rev = "REL${builtins.replaceStrings ["."] ["_"] version}";
    hash = "sha256-KbCS3kg2MoxKHl+35UOFCSF4kPPsIMeO7AfwfHZYZVg=";
  };

  passthru.updateScript = pkgs.nix-update-script { extraArgs = [ "--version-regex=REL(.*)" ]; };
}
