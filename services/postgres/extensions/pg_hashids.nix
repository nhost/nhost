{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_hashids";
  version = "8c404dd86408f3a987a3ff6825ac7e42bd618b98";

  src = pkgs.fetchFromGitHub {
    owner = "iCyberon";
    repo = "pg_hashids";
    rev = version;
    hash = "sha256-mlS3YDE0VvF9zuLgz+EWSNLBZR1ptrU5A8ndY72194E=";
  };
}
