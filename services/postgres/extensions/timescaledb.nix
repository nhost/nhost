{
  buildPGXSExtension,
  pkgs,
  ...
}:
buildPGXSExtension rec {
  pname = "timescaledb-apache";
  version = "2.30.0";

  nativeBuildInputs = [ pkgs.cmake ];
  buildInputs = [
    pkgs.openssl
    pkgs.libkrb5
  ];

  src = pkgs.fetchFromGitHub {
    owner = "timescale";
    repo = "timescaledb";
    rev = version;
    hash = "sha256-Yg/ESY85OT9yYW2EnFBTfsPZtJc6gNPwrx04splVZgU=";
  };

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
