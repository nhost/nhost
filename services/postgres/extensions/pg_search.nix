{ buildPGRXExtension, pkgs, ... }:

let
  # lindera-{ipadic,ko-dic,cc-cedict} 6.2.0 build.rs scripts download
  # MeCab dictionary tarballs from lindera.dev. The sandbox has no
  # network, so we pre-fetch them and seed the dictionary build cache; the build
  # script verifies the MD5 and skips the download.
  linderaIpadic = pkgs.fetchurl {
    url = "https://Lindera.dev/mecab-ipadic-2.7.0-20250920.tar.gz";
    sha256 = "0gfvcbhji5rfca91gglbwaqzpy0d20fsii71dbjr8w7ybxj9zfm7";
  };
  linderaKoDic = pkgs.fetchurl {
    url = "https://Lindera.dev/mecab-ko-dic-2.1.1-20180720.tar.gz";
    sha256 = "06jr4306f1bxsd02jpwp8d28vxaawmganx66xfd9szhnqqhysb3h";
  };
  linderaCcCedict = pkgs.fetchurl {
    url = "https://lindera.dev/CC-CEDICT-MeCab-0.1.0-20200409.tar.gz";
    sha256 = "1j0n14fs84zznvmgb579sb58qfylv84xr0y71rzn904axkizjg7d";
  };
  linderaCacheVersion = "6.2.0-fmt2";
in
buildPGRXExtension rec {
  pname = "pg_search";
  version = "0.26.7";

  cargo-pgrx = pkgs.nhost.cargo-pgrx_0_19_3;

  doCheck = false;

  buildInputs = [
    pkgs.icu
    pkgs.openblas
  ];
  nativeBuildInputs = [
    pkgs.pkg-config
    # Upstream uses -fuse-ld=lld; keep Nix's RUNPATH handling for shared dependencies.
    pkgs.llvmPackages.bintools
  ];

  cargoPgrxFlags = [
    "--package=pg_search"
  ];

  src = pkgs.fetchFromGitHub {
    owner = "paradedb";
    repo = "paradedb";
    rev = "v${version}";
    hash = "sha256-axNT/K9MoV5R/hRoIHny4veOd1WyDDchq9+QEwEFCdU=";
  };

  cargoHash = "sha256-U5iPlRlcXFKFmlIbR51pFXCC4GMrNgzSsa3QbmBAcxA=";

  preBuild = ''
    export LINDERA_BUILD_DICTIONARY_CACHE_DIR=$TMPDIR/lindera-cache
    mkdir -p $LINDERA_BUILD_DICTIONARY_CACHE_DIR/${linderaCacheVersion}
    cp ${linderaIpadic}     $LINDERA_BUILD_DICTIONARY_CACHE_DIR/${linderaCacheVersion}/mecab-ipadic-2.7.0-20250920.tar.gz
    cp ${linderaKoDic}      $LINDERA_BUILD_DICTIONARY_CACHE_DIR/${linderaCacheVersion}/mecab-ko-dic-2.1.1-20180720.tar.gz
    cp ${linderaCcCedict}   $LINDERA_BUILD_DICTIONARY_CACHE_DIR/${linderaCacheVersion}/CC-CEDICT-MeCab-0.1.0-20200409.tar.gz
  '';
}
