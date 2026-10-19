{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgsql-http";
  version = "1.7.2";

  src = pkgs.fetchFromGitHub {
    owner = "pramsey";
    repo = "pgsql-http";
    rev = "v${version}";
    hash = "sha256-ML7lfzGWUjGuclwQ+U+y9i2WsYA2Q9zR4Xt6JNG+y3w=";
  };

  buildInputs = [ pkgs.curl ];
  nativeBuildInputs = [ pkgs.curl ];
}
