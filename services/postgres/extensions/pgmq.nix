{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgmq";
  version = "1.12.0";

  src = pkgs.fetchFromGitHub {
    owner = "tembo-io";
    repo = "pgmq";
    rev = "v${version}";
    hash = "sha256-yyE5XcwmVC2j4tXx5je6+BvsKD96JVZ/mY5xRyeq8gc=";
  };

  sourceRoot = "${src.name}/pgmq-extension";

  dontConfigure = true;
}
