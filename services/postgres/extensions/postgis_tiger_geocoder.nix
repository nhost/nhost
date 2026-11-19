{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "postgis_tiger_geocoder";
  version = "2025.2";

  src = pkgs.fetchzip {
    url = "https://download.osgeo.org/postgis/source/postgis_tiger_geocoder/${pname}-${version}.tar.gz";
    hash = "sha256-p7MP2gSjynRN4wrMcladzjwHeRuklC40xjTGokGQIuU=";
  };

  nativeBuildInputs = [ pkgs.perl ];
}
