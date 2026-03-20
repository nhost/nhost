{ buildPGXSExtension, pkgs, ... }:
buildPGXSExtension rec {
  pname = "pgrouting";
  version = "4.0.0";

  nativeBuildInputs = with pkgs; [
    cmake
    perl
  ];

  buildInputs = with pkgs; [ boost ];

  src = pkgs.fetchFromGitHub {
    owner = "pgRouting";
    repo = "pgrouting";
    tag = "v${version}";
    hash = "sha256-HtTWpOE/4UzhUou3abuTKVTZ4yTANeHLl7UB1lLaikg=";
  };
}

