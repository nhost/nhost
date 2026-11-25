{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "address_standardizer";
  version = "3.7.0";

  src = pkgs.fetchFromGitHub {
    owner = "postgis";
    repo = pname;
    tag = "v${version}";
    hash = "sha256-13kI9VmSCYDUy5fv3v/lA9K8uPf0aWOo4xAGCjJq648=";
  };

  buildInputs = [ pkgs.pcre2 ];
  nativeBuildInputs = [ pkgs.perl ];

  postInstall = ''
    # Existing functions can be loaded during collation repair, before their
    # extension SQL is updated to the standalone library's unversioned name.
    ln -s address_standardizer.so "$out/lib/address_standardizer-3.so"

    # The standalone release uses SQL version 3.7 and only ships an ANY
    # update script. Preserve automatic upgrades from the bundled 3.6 series.
    for extension in address_standardizer address_standardizer_data_us; do
      for previous in 3.6.0 3.6.1 3.6.2 3.6.3 3.6.4; do
        ln -s "$extension--ANY--3.7.sql" \
          "$out/share/postgresql/extension/$extension--$previous--3.7.sql"
      done
    done
  '';
}
