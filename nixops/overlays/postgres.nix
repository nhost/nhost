final: prev: rec {
  postgresql_14 = (prev.postgresql_14.override { systemdSupport = false; }).overrideAttrs (
    finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "14.23";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-fjoboaUhrHFDqusmIXzSS5ZnIpSRHO9+qcqvkchl2dM=";
      };

      doCheck = false;
      doInstallCheck = false;
    }
  );

  postgresql_14-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_14.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_14}/bin/psql $out/bin/
      cp ${postgresql_14}/bin/pg_dump $out/bin/
      cp ${postgresql_14}/bin/pg_dumpall $out/bin/
      cp ${postgresql_14}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_15 = (prev.postgresql_15.override { systemdSupport = false; }).overrideAttrs (
    finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "15.18";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-tw1zzgLXx7Jr4bi8rMKRmTJzOSQFGvrP2nHr9FcVrjs=";
      };
    }
  );

  postgresql_15-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_15.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_15}/bin/psql $out/bin/
      cp ${postgresql_15}/bin/pg_dump $out/bin/
      cp ${postgresql_15}/bin/pg_dumpall $out/bin/
      cp ${postgresql_15}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_16 = (prev.postgresql_16.override { systemdSupport = false; }).overrideAttrs (
    finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "16.14";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-g2+OdB2dGIKBSFJ24Z3Yy7oRAFywNMSVDdWfnsaeJJQ=";
      };
    }
  );

  postgresql_16-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_16.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_16}/bin/psql $out/bin/
      cp ${postgresql_16}/bin/pg_dump $out/bin/
      cp ${postgresql_16}/bin/pg_dumpall $out/bin/
      cp ${postgresql_16}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_17 = (prev.postgresql_17.override { systemdSupport = false; }).overrideAttrs (
    finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "17.10";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-3ZAqlT3R8ywhNH13oqz2VUbSwpOJ2JaICbxZ29awaMw=";
      };
    }
  );

  postgresql_17-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_17.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_17}/bin/psql $out/bin/
      cp ${postgresql_17}/bin/pg_dump $out/bin/
      cp ${postgresql_17}/bin/pg_dumpall $out/bin/
      cp ${postgresql_17}/bin/pg_restore $out/bin/
    '';
  };

  postgresql_18 = (prev.postgresql_18.override { systemdSupport = false; }).overrideAttrs (
    finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "18.4";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-Ac/Dqcj8vjcW3my5vsnKaMiQqTq/HPtUzckJ3SMyrfA=";
      };
    }
  );

  postgresql_18-client = final.stdenv.mkDerivation {
    pname = "postgresql-client";
    version = postgresql_18.version;

    phases = [ "installPhase" ];

    installPhase = ''
      mkdir -p $out/bin
      cp ${postgresql_18}/bin/psql $out/bin/
      cp ${postgresql_18}/bin/pg_dump $out/bin/
      cp ${postgresql_18}/bin/pg_dumpall $out/bin/
      cp ${postgresql_18}/bin/pg_restore $out/bin/
    '';
  };

  # https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/rust/cargo-pgrx/default.nix
  cargo-pgrx_0_17_0 = final.rustPlatform.buildRustPackage rec {
    pname = "cargo-pgrx";
    version = "0.17.0";

    src = final.fetchCrate {
      pname = "cargo-pgrx";
      hash = "sha256-Ld7m7ggxlf8FufpeiAE9qcu49X0SgX6XXHS6KIewGyA=";
      inherit version;
    };

    cargoHash = "sha256-hNj39YzJna8iZxnlrLz+uLduxaD+uvggQRM7ng3MN1k=";

    nativeBuildInputs = [
      final.pkg-config
    ];

    buildInputs = [
      final.openssl
    ];

    preCheck = ''
      export PGRX_HOME=$(mktemp -d)
    '';

    checkFlags = [
      # requires pgrx to be properly initialized with cargo pgrx init
      "--skip=command::schema::tests::test_parse_managed_postmasters"
    ];
  };

  wal-g = prev.wal-g.overrideAttrs (
    finalAttrs: previousAttrs: {
      version = "3.0.7";

      src = final.fetchFromGitHub {
        owner = "wal-g";
        repo = "wal-g";
        rev = "v${finalAttrs.version}";
        hash = "sha256-kUn1pJEdGec+WIZivqVAhELoBTKOF4E07Ovn795DgIY=";
      };

      vendorHash = "sha256-TwYl3B/VS24clUv1ge/RroULIY/04xTxc11qPNGhnfs=";
    }
  );
}
