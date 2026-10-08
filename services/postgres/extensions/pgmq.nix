{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgmq";
  version = "1.13.0";

  src = pkgs.fetchFromGitHub {
    owner = "tembo-io";
    repo = "pgmq";
    rev = "v${version}";
    hash = "sha256-0/L/ic6WZ64Uc6JDNnKGVFVpQa2a+3OGIeyQwPFTJ5U=";
  };

  sourceRoot = "${src.name}/pgmq-extension";

  dontConfigure = true;
}
