{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "hypopg";
  version = "1.4.3";

  src = pkgs.fetchFromGitHub {
    owner = "HypoPG";
    repo = "hypopg";
    rev = version;
    hash = "sha256-d8j1mvn/9R8LEQCqstBxddRqQYZ9k4hcOrlQp7cPtYI=";
  };

  passthru = {
    updateScript = pkgs.gitUpdater {
      ignoredVersions = "beta";
    };
  };
}
