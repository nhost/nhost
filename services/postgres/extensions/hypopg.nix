{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "hypopg";
  version = "1.4.2";

  src = pkgs.fetchFromGitHub {
    owner = "HypoPG";
    repo = "hypopg";
    rev = version;
    hash = "sha256-J1ltvNHB2v2I9IbYjM8w2mhXvBX31NkMasCL0O7bV8w=";
  };

  passthru = {
    updateScript = pkgs.gitUpdater {
      ignoredVersions = "beta";
    };
  };
}
