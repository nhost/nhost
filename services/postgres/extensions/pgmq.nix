{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgmq";
  version = "1.13.1";

  src = pkgs.fetchFromGitHub {
    owner = "tembo-io";
    repo = "pgmq";
    rev = "v${version}";
    hash = "sha256-INmTODNrsEiUPNyl22RNmJiX5/GH+ud7orVj26darFk=";
  };

  sourceRoot = "${src.name}/pgmq-extension";

  dontConfigure = true;
}
