{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "ip4r";
  version = "2.4.2";

  src = pkgs.fetchFromGitHub {
    owner = "RhodiumToad";
    repo = "ip4r";
    rev = "${version}";
    hash = "sha256-3chAD4f4A6VlXVSI0kfC/ANcnFy4vBp4FZpT6QRAueQ=";
  };
}
