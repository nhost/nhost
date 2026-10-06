{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_ivm";
  version = "1.15";

  src = pkgs.fetchFromGitHub {
    owner = "sraoss";
    repo = pname;
    rev = "v${version}";
    hash = "sha256-8JQ7r/e5FRAWsshTcTmPnVnbwjXkshP4yaulYS7Zse4=";
  };
}
