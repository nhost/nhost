final: prev:
let
  rust_1_96 = final.rust-bin.stable."1.96.1".default;

  rustPlatform_1_96 = final.makeRustPlatform {
    cargo = rust_1_96;
    rustc = rust_1_96;
  };

  # https://github.com/NixOS/nixpkgs/blob/master/pkgs/development/tools/rust/cargo-pgrx/default.nix
  mkCargoPgrx =
    {
      version,
      hash,
      cargoHash,
    }:
    rustPlatform_1_96.buildRustPackage rec {
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
      version = "14.24";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-p/p+09VYFyNV9RQGCXp71Pa0c76A8xHvfNqWvzg9iJc=";
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
      version = "15.19";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-4aZKh6RrgluIwILkUYFhpHqrU8RWlJZPi6HfKPeFn4k=";
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
      version = "16.15";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-wVdTQfp71A9SdOpGWzQ5D03GTN0HcK8ycAXKrrn2t+0=";
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
      version = "17.11";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-3Sfys8Wec+0UqjMkkBJCv2mgMqY0eAXydOYmAyLUKXk=";
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
      version = "18.6";

      src = final.fetchurl {
        url = "mirror://postgresql/source/v${version}/${pname}-${version}.tar.bz2";
        hash = "sha256-VVYQwk1T5DFtpbfT/CXCedloVtXg4j7jCMMoxfqIHZ8=";
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

  inherit rustPlatform_1_96;

  cargo-pgrx_0_19_0 = mkCargoPgrx {
    version = "0.19.0";
    hash = "sha256-1OTE+mPtR9vaJhVGvq9X3fNd1nRoedoABUaVGQvFwNU=";
    cargoHash = "sha256-dTfbgc6pGLP3s9y3zfIk97XUkPiLngdIoilIX7UM4W8=";
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
