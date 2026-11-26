{
  buildPGXSExtension,
  pkgs,
  postgresql,
  ...
}:
let
  gdal = pkgs.gdalMinimal;
in
buildPGXSExtension rec {
  pname = "postgis";
  version = "3.7.0";

  outputs = [
    "out"
    "doc"
  ];

  src = pkgs.fetchFromGitHub {
    owner = "postgis";
    repo = "postgis";
    tag = version;
    hash = "sha256-38bL4TdzciqOtwCH3Lbxuz9ZTb6qEmLBrDXujgJ/A5s=";
  };

  buildInputs = [
    pkgs.geos
    pkgs.gmp
    pkgs.proj
    gdal
    pkgs.json_c
    pkgs.protobufc
    pkgs.pcre2.dev
  ]
  ++ pkgs.lib.optional pkgs.stdenv.hostPlatform.isDarwin pkgs.libiconv;

  nativeBuildInputs = with pkgs; [
    autoconf
    automake
    libtool
    libxml2
    perl
    pkg-config
    protobufc
    which
  ];

  dontDisableStatic = true;

  checkInputs = with pkgs; [
    cunit
  ];

  nativeCheckInputs = [
    postgresql
    pkgs.postgresqlTestHook
    pkgs.libxslt
  ];

  postgresqlTestUserOptions = "LOGIN SUPERUSER";

  # postgis config directory assumes /include /lib from the same root for json-c library
  env.NIX_LDFLAGS = "-L${pkgs.lib.getLib pkgs.json_c}/lib";

  setOutputFlags = false;
  preConfigure = ''
    ./autogen.sh
  '';

  configureFlags = [
    "--with-gdalconfig=${pkgs.gdalMinimal}/bin/gdal-config"
    "--with-jsondir=${pkgs.json_c.dev}"
    "--disable-extension-upgrades-install"
    # "--with-sfcgal=${pkgs.sfcgal}/bin/sfcgal-config"
  ];

  makeFlags = [
    "PERL=${pkgs.perl}/bin/perl"
  ];

  doCheck = pkgs.stdenv.hostPlatform.isLinux;

  preCheck = ''
    substituteInPlace doc/postgis-out.xml --replace-fail "http://docbook.org/xml/5.0/dtd/docbook.dtd" "${pkgs.docbook5}/xml/dtd/docbook/docbookx.dtd"
    # The test suite hardcodes it to use /tmp.
    export PGIS_REG_TMPDIR="$TMPDIR/pgis_reg"
  '';

  # create aliases for all commands adding version information
  postInstall = ''
    for prog in $out/bin/*; do # */
      ln -s $prog $prog-${version}
    done

    # The disabled bulk upgrade install omits old-version tags. Keep paths
    # from every version shipped with PG17/PG18 via the upstream ANY scripts.
    for extension in postgis postgis_raster postgis_topology; do
      for previous in 3.5.0 3.5.2 3.5.3 3.6.1 3.6.2 3.6.4; do
        ln -s "$extension--TEMPLATED--TO--ANY.sql" \
          "$out/share/postgresql/extension/$extension--$previous--ANY.sql"
      done
    done

    mkdir -p $doc/share/doc/postgis
    mv doc/* $doc/share/doc/postgis/
  '';
}
