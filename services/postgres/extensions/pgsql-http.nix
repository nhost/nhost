{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pgsql-http";
  version = "1.7.0";

  src = pkgs.fetchFromGitHub {
    owner = "pramsey";
    repo = "pgsql-http";
    rev = "v${version}";
    hash = "sha256-tgmty8ZYpSEccwQouI/Ho2M495k6DizbMaaJ0+aW03Q=";
  };

  buildInputs = [ pkgs.curl ];
  nativeBuildInputs = [ pkgs.curl ];
}
