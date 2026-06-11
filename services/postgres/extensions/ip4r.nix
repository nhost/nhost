{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "ip4r";
  version = "2.4.3";

  src = pkgs.fetchFromGitHub {
    owner = "RhodiumToad";
    repo = "ip4r";
    rev = "${version}";
    hash = "sha256-IWGVHd9uc7pCRZL9FMTwSs50rkRwXafjB3Vq72qAonA=";
  };
}
