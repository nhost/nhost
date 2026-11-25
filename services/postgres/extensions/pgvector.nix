{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgvector";
  version = "0.8.7";

  src = pkgs.fetchFromGitHub {
    owner = "pgvector";
    repo = "pgvector";
    rev = "v${version}";
    hash = "sha256-YYXz8zqiuqYWpJwImAhMry/QTLHKOP5MzuY0Of+aflc=";
  };
}
