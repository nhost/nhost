{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgmq";
  version = "1.8.0";

  src = pkgs.fetchFromGitHub {
    owner = "tembo-io";
    repo = "pgmq";
    rev = "v${version}";
    hash = "sha256-oXsThqRs+nrNCb9A560gW3sm6LPQFucrlSolNCi0z3w=";
  };

  sourceRoot = "${src.name}/pgmq-extension";

  dontConfigure = true;
}
