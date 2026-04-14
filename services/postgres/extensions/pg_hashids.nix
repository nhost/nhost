{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_hashids";
  version = "cd0e1b31d52b394a0df64079406a14a4f7387cd6";

  src = pkgs.fetchFromGitHub {
    owner = "iCyberon";
    repo = "pg_hashids";
    rev = version;
    hash = "sha256-Nmb7XLqQflYZfqj0yrewfb1Hl5YgEB5wfjBunPwIuOU=";
  };
}
