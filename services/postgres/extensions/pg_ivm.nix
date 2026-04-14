{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_ivm";
  version = "1.13";

  src = pkgs.fetchFromGitHub {
    owner = "sraoss";
    repo = pname;
    rev = "v${version}";
    hash = "sha256-DKU5jwnRo/kMycnq4nAdQTiZwv/wXybyjXLtz4xdaBo=";
  };
}
