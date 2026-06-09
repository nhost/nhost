{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_ivm";
  version = "1.14";

  src = pkgs.fetchFromGitHub {
    owner = "sraoss";
    repo = pname;
    rev = "v${version}";
    hash = "sha256-z6g8ofu1s4SrQzasE9qOo3kjdFe00EZjvgVLewoGoDU=";
  };
}
