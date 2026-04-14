{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgvector";
  version = "0.8.2";

  src = pkgs.fetchFromGitHub {
    owner = "pgvector";
    repo = "pgvector";
    rev = "v${version}";
    hash = "sha256-TLPlH+amFdeI2pEsUZuvoQ1JA0sCMiIAWdkgqGBo4mI=";
  };
}
