{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_ivm";
  version = "1.17";

  src = pkgs.fetchFromGitHub {
    owner = "sraoss";
    repo = pname;
    rev = "v${version}";
    hash = "sha256-fZsd0GU+syKf6B8Da1zbV7hdfUd9KBmGmkZlB5+uvCw=";
  };
}
