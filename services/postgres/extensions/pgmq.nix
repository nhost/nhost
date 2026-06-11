{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgmq";
  version = "1.11.1";

  src = pkgs.fetchFromGitHub {
    owner = "tembo-io";
    repo = "pgmq";
    rev = "v${version}";
    hash = "sha256-BPOrQ7HcgTaTJIRzWUCG3iJN3mUjwIxa/wPxvJ1l4o4=";
  };

  sourceRoot = "${src.name}/pgmq-extension";

  dontConfigure = true;
}
