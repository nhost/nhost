final: prev: rec {
  postgresql_16_10 = (prev.postgresql_16.override { systemdSupport = false; }).overrideAttrs (finalAttrs: previousAttrs: rec {
    pname = "postgresql";
    version = "16.10";

    src = final.fetchurl {
      url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
      hash = "sha256-3oSF9M6cMuPd/u8LfCYe7RzstUybzRcOQ3/0VMspK0I=";
    };
  });

  postgresql_16_10-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_16_10.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_16_10}/bin/psql $out/bin/
      cp ${postgresql_16_10}/bin/pg_dump $out/bin/
      cp ${postgresql_16_10}/bin/pg_dumpall $out/bin/
      cp ${postgresql_16_10}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_17_6 = (prev.postgresql_17.override { systemdSupport = false; }).overrideAttrs (finalAttrs: previousAttrs: rec {
    pname = "postgresql";
    version = "17.6";

    src = final.fetchurl {
      url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
      hash = "sha256-4GMKNgCuonURcVVjJZ7CERzV9DU6SwQOC+gn+UzXqLA=";
    };
  });

  postgresql_17_6-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_17_6.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_17_6}/bin/psql $out/bin/
      cp ${postgresql_17_6}/bin/pg_dump $out/bin/
      cp ${postgresql_17_6}/bin/pg_dumpall $out/bin/
      cp ${postgresql_17_6}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_18_0 = (prev.postgresql_18.override { systemdSupport = false; }).overrideAttrs (finalAttrs: previousAttrs: rec {
    pname = "postgresql";
    version = "18.0";

    src = final.fetchurl {
      url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
      hash = "sha256-DVuQOx5f42G8p6qVB1GZM3c+s0JmsTV8TneA/e5tYHg=";
    };
  });

  postgresql_18_0-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_18_0.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_17_6}/bin/psql $out/bin/
      cp ${postgresql_17_6}/bin/pg_dump $out/bin/
      cp ${postgresql_17_6}/bin/pg_dumpall $out/bin/
      cp ${postgresql_17_6}/bin/pg_restore $out/bin/
    '';
  };
}
