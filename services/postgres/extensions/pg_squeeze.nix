{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_squeeze";
  version = "1.9.4";

  src = pkgs.fetchFromGitHub {
    owner = "cybertec-postgresql";
    repo = "pg_squeeze";
    rev = "REL${builtins.replaceStrings [ "." ] [ "_" ] version}";
    hash = "sha256-AOhdl/EJNsQrl9ES/9flsVGy92KgpKV8no3etj0YzIk=";
  };

  passthru.updateScript = pkgs.nix-update-script { extraArgs = [ "--version-regex=REL(.*)" ]; };
}
