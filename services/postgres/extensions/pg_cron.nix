{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_cron";
  version = "1.6.7";

  src = pkgs.fetchFromGitHub {
    owner = "citusdata";
    repo = pname;
    rev = "v${version}";
    hash = "sha256-oQjaQeIEMbg5pipY8tT4I7bNdyDOwcr/ZJikqgcEZOs=";
  };
}
