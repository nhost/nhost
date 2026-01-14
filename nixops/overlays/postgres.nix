final: prev: rec {
  postgresql_16_11 = (prev.postgresql_16.override { systemdSupport = false; }).overrideAttrs (finalAttrs: previousAttrs: rec {
    pname = "postgresql";
    version = "16.11";

    src = final.fetchurl {
      url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
      hash = "sha256-besIwj0D132Pi9HBQEnu72Su+JaP2Ikd8t/AtC8Xjqw=";
    };
  });

  postgresql_16_11-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_16_11.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_16_11}/bin/psql $out/bin/
      cp ${postgresql_16_11}/bin/pg_dump $out/bin/
      cp ${postgresql_16_11}/bin/pg_dumpall $out/bin/
      cp ${postgresql_16_11}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_17_7 = (prev.postgresql_17.override { systemdSupport = false; }).overrideAttrs (finalAttrs: previousAttrs: rec {
    pname = "postgresql";
    version = "17.7";

    src = final.fetchurl {
      url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
      hash = "sha256-7540MwLszTMRLxsvAke+STy1doMTretViwLeh5ei6bU=";
    };
  });

  postgresql_17_7-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_17_7.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_17_7}/bin/psql $out/bin/
      cp ${postgresql_17_7}/bin/pg_dump $out/bin/
      cp ${postgresql_17_7}/bin/pg_dumpall $out/bin/
      cp ${postgresql_17_7}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_18_1 = (prev.postgresql_18.override { systemdSupport = false; }).overrideAttrs (finalAttrs: previousAttrs: rec {
    pname = "postgresql";
    version = "18.1";

    src = final.fetchurl {
      url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
      hash = "sha256-/4ZnXDNsRumKyZHrswbRtnYh7OHQZ4e+qt4xLCyRXVQ=";
    };
  });

  postgresql_18_1-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_18_1.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_18_1}/bin/psql $out/bin/
      cp ${postgresql_18_1}/bin/pg_dump $out/bin/
      cp ${postgresql_18_1}/bin/pg_dumpall $out/bin/
      cp ${postgresql_18_1}/bin/pg_restore $out/bin/
    '';
  };

}
