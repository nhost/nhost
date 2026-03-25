{ buildPGXSExtension, pkgs, postgresql, ... }:
let
  # latest supported version for PostgreSQL 14
  pg14Config = {
    version = "2.19.3";
    hash = "sha256-CMK9snkMXsXqmq3f1hTDYCduL0arwM7XyIg4xq6UfR8=";
  };

  pgLatestConfig = {
    version = "2.25.2";
    hash = "sha256-PtkeGuBWGYMiacVUnJcM+jDDNxis9IQTcwQuaaUqMvE=";
  };

  isPostgres15 = pkgs.lib.versionAtLeast postgresql.version "15";
  config = if isPostgres15 then pgLatestConfig else pg14Config;
in
buildPGXSExtension rec {
  pname = "timescaledb-apache";
  version = config.version;

  nativeBuildInputs = [ pkgs.cmake ];
  buildInputs = [
    pkgs.openssl
    pkgs.libkrb5
  ];

  src = pkgs.fetchFromGitHub {
    owner = "timescale";
    repo = "timescaledb";
    rev = version;
    hash = config.hash;
  };

  cmakeFlags =
    [
      "-DSEND_TELEMETRY_DEFAULT=OFF"
      "-DREGRESS_CHECKS=OFF"
      "-DTAP_CHECKS=OFF"
      "-DAPACHE_ONLY=ON"
    ]
    ++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isDarwin [ "-DLINTER=OFF" ];

  # Fix the install phase which tries to install into the pgsql extension dir,
  # and cannot be manually overridden. This is rather fragile but works OK.
  postPatch = ''
    for x in CMakeLists.txt sql/CMakeLists.txt; do
      substituteInPlace "$x" \
        --replace-fail 'DESTINATION "''${PG_SHAREDIR}/extension"' "DESTINATION \"$out/share/postgresql/extension\""
    done

    for x in src/CMakeLists.txt src/loader/CMakeLists.txt tsl/src/CMakeLists.txt; do
      substituteInPlace "$x" \
        --replace-fail 'DESTINATION ''${PG_PKGLIBDIR}' "DESTINATION \"$out/lib\""
    done
  '';
}
