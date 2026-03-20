{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgmq";
  version = "1.11.0";

  src = pkgs.fetchFromGitHub {
    owner = "tembo-io";
    repo = "pgmq";
    rev = "v${version}";
    hash = "sha256-fJWINP7Dvc79blpfYbGfTEKZtcA/S8KAjmX5uPhmXBM=";
  };

  sourceRoot = "${src.name}/pgmq-extension";

  dontConfigure = true;
}
