{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgvector";
  version = "0.8.6";

  src = pkgs.fetchFromGitHub {
    owner = "pgvector";
    repo = "pgvector";
    rev = "v${version}";
    hash = "sha256-4PVr0dW6CL3ov1W5BPJU1CAphwOyXwqUoYgWCPXjto8=";
  };
}
