{ buildPGXSExtension, pkgs, ... }:
buildPGXSExtension rec {
  pname = "pgrouting";
  version = "4.0.1";

  nativeBuildInputs = with pkgs; [
    cmake
    perl
  ];

  buildInputs = with pkgs; [ boost ];

  src = pkgs.fetchFromGitHub {
    owner = "pgRouting";
    repo = "pgrouting";
    tag = "v${version}";
    hash = "sha256-j3dlVcENhBveVmkuzWaLfHWy73OMDpC2FxrNQ4W6m9k=";
  };
}

