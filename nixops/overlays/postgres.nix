final: prev:
let
  # https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/rust/cargo-pgrx/default.nix
  mkCargoPgrx =
    {
      version,
      hash,
      cargoHash,
    }:
    final.rustPlatform.buildRustPackage rec {
      pname = "cargo-pgrx";
      inherit version cargoHash;

      src = final.fetchCrate {
        inherit pname version hash;
      };

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
        "--skip=object_utils::tests::parses_managed_postmasters"
        # fixtures are not included in the crates.io source archive
        "--skip=command::upgrade::tests::find_package_manifest_in_workspace"
        "--skip=command::upgrade::tests::process_workspace_manifest"
        "--skip=command::upgrade::tests::process_workspace_package_manifest"
      ];
    };
in
rec {
  postgresql_14 = (prev.postgresql_14.override { systemdSupport = false; }).overrideAttrs (
    finalAttrs: previousAttrs: rec {
      pname = "postgresql";
      version = "14.25";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-Ca+YDrOl0KitejS5UDGxmIu81DDIdwCmLWI0wO2Xrkw=";
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
      version = "15.20";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-MOZcu7dxo5tVPtLffmViLmVkeu1V28Gb0P6FP/CghEI=";
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
      version = "16.16";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-nVzYYzBDt1dA1dWXSca3Nl5q61PEcJixpegLsY+HiBo=";
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
      version = "17.12";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-nPE2pwPY7i+DRlxDvk6ejnkwyCsL+6E75+JTe+dprFU=";
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
      version = "18.7";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-RB365CgMrj4EJeX4dvgFWfsHMcFA8ariKz5aVNBBG/0=";
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

  cargo-pgrx_0_19_3 = mkCargoPgrx {
    version = "0.19.3";
    hash = "sha256-TyViMU+ZLUHNK5CRi8CN3tThFNUJQnuWTeCxT2JTYG0=";
    cargoHash = "sha256-43B3zl/mJXuBD/w8x+lek7Wtg/lZ/bZWuJdv5v9ImSE=";
  };

  cargo-pgrx_0_19_2 = mkCargoPgrx {
    version = "0.19.2";
    hash = "sha256-PANc819AhIE9yJ6NFHGJxHJHWZyR2Srmj2cEz3vQmJk=";
    cargoHash = "sha256-cTD7x36FvFUIwVLuAqrOJ75vLDppITiDrY8Fs3RjPqU=";
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
