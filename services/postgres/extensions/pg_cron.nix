{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_cron";
  version = "1.6.8";

  src = pkgs.fetchFromGitHub {
    owner = "citusdata";
    repo = pname;
    rev = "v${version}";
    hash = "sha256-i5bgIFBjpb2KVUk9eABz7CpP+AwlgKAPQI0vNPd7Eb8=";
  };
}
