{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "hypopg";
  version = "1.4.5";

  src = pkgs.fetchFromGitHub {
    owner = "HypoPG";
    repo = "hypopg";
    rev = version;
    hash = "sha256-uxUHGBPLnSk59A4/EYQVIDqXa5zi0mCw2MX6jfZyAPY=";
  };

  passthru = {
    updateScript = pkgs.gitUpdater {
      ignoredVersions = "beta";
    };
  };
}
