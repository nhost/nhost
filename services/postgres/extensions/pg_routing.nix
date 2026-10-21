{ buildPGXSExtension, pkgs, ... }:
buildPGXSExtension rec {
  pname = "pgrouting";
  version = "4.0.2";

  nativeBuildInputs = with pkgs; [
    cmake
    perl
  ];

  buildInputs = with pkgs; [ boost ];

  src = pkgs.fetchFromGitHub {
    owner = "pgRouting";
    repo = "pgrouting";
    tag = "v${version}";
    hash = "sha256-bETj/tG9O0kymTeJM9YlXzMPcBeegxnYQH/tMQsuXtY=";
  };
}
