{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgvector";
  version = "0.8.1";

  src = pkgs.fetchFromGitHub {
    owner = "pgvector";
    repo = "pgvector";
    rev = "v${version}";
    hash = "sha256-4EqazYWstczL9T3YFqq2gtbcKIj6zWU8ItYt2nnwPYo=";
  };
}
