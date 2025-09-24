final: prev: rec {
  postgresql_14_18 = prev.postgresql_14.overrideAttrs
    (finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "14.18";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-g6sp1r/D3Fiy7TxmQRT9++tqBFDEuNf6aa7pHjyhT44=";
      };

      doCheck = false;
      doInstallCheck = false;
    });

  postgresql_14_18-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_14_18.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_14_18}/bin/psql $out/bin/
      cp ${postgresql_14_18}/bin/pg_dump $out/bin/
      cp ${postgresql_14_18}/bin/pg_dumpall $out/bin/
      cp ${postgresql_14_18}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_15_13 = prev.postgresql_15.overrideAttrs
    (finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "15.13";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-T2LhM9IuoIoEAbCECSDiZphkTQGoDDQ0H7cy3QqQyl0=";
      };
    });

  postgresql_15_13-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_15_13.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_15_13}/bin/psql $out/bin/
      cp ${postgresql_15_13}/bin/pg_dump $out/bin/
      cp ${postgresql_15_13}/bin/pg_dumpall $out/bin/
      cp ${postgresql_15_13}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_16_9 = prev.postgresql_16.overrideAttrs
    (finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "16.9";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-B8APuCTfCgwpXySfRGkbhuMmZ1OzgMlvYzwzEeEL0AU=";
      };
    });

  postgresql_16_9-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_16_9.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_16_9}/bin/psql $out/bin/
      cp ${postgresql_16_9}/bin/pg_dump $out/bin/
      cp ${postgresql_16_9}/bin/pg_dumpall $out/bin/
      cp ${postgresql_16_9}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_17_5 = prev.postgresql_17.overrideAttrs
    (finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "17.5";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-/LerOOI7Jk0ZAssl5q2vtFJabry9AVQ0ru+e2oD1KNg=";
      };
    });

  postgresql_17_5-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_17_5.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_17_5}/bin/psql $out/bin/
      cp ${postgresql_17_5}/bin/pg_dump $out/bin/
      cp ${postgresql_17_5}/bin/pg_dumpall $out/bin/
      cp ${postgresql_17_5}/bin/pg_restore $out/bin/
    '';
  };
}
