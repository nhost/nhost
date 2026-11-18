{
  buildPGXSExtension,
  pkgs,
  ...
}:
buildPGXSExtension rec {
  pname = "timescaledb-apache";
  version = "2.32.0";

  nativeBuildInputs = [ pkgs.cmake ];
  buildInputs = [
    pkgs.openssl
    pkgs.libkrb5
  ];

  src = pkgs.fetchFromGitHub {
    owner = "timescale";
    repo = "timescaledb";
    rev = version;
    hash = "sha256-tOXMk+bRBKEf78TrRPpuMHQZLM2ahq8oyypNuSV/MaE=";
  };

  # Backport the upstream PostgreSQL 18.7/17.12 portal lifecycle fix until
  # TimescaleDB 2.32.1 is released. No extension SQL changes are needed.
  patches = [
    (pkgs.fetchurl {
      url = "https://github.com/timescale/timescaledb/commit/dc4110b17f8d0a004e1ea96ad54a630f95a70afe.patch";
      hash = "sha256-saf0c5atuhl4M4Lcj5PpIiZlJJuQ5ifcNSJZm3MpFuI=";
    })
  ];

  cmakeFlags = [
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
