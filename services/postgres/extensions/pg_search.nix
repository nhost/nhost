{ buildPGRXExtension, pkgs, ... }:

let
  # lindera-{ipadic,ko-dic,cc-cedict} 1.4.1 build.rs scripts download
  # MeCab dictionary tarballs from lindera.dev. The sandbox has no
  # network, so we pre-fetch them and seed LINDERA_CACHE; the build
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
  linderaVersion = "1.4.1";
in
buildPGRXExtension rec {
  pname = "pg_search";
  version = "0.22.2";

  cargo-pgrx = pkgs.cargo-pgrx_0_17_0;

  doCheck = false;

  buildInputs = [ pkgs.icu ];
  nativeBuildInputs = [ pkgs.pkg-config ];

  cargoPgrxFlags = [
    "--package=pg_search"
  ];

  src = pkgs.fetchFromGitHub {
    owner = "paradedb";
    repo = "paradedb";
    rev = "v${version}";
    hash = "sha256-BqmYuSmA/yrfw8Np1HghOcFs7erv0SiryiGyDpV7CQQ=";
  };

  cargoHash = "sha256-kZfWYk3bx3bKV3GcDikrhg3N7gg31bi86V7dvotLtTE=";

  preBuild = ''
    export LINDERA_CACHE=$TMPDIR/lindera-cache
    mkdir -p $LINDERA_CACHE/${linderaVersion}
    cp ${linderaIpadic}     $LINDERA_CACHE/${linderaVersion}/mecab-ipadic-2.7.0-20250920.tar.gz
    cp ${linderaKoDic}      $LINDERA_CACHE/${linderaVersion}/mecab-ko-dic-2.1.1-20180720.tar.gz
    cp ${linderaCcCedict}   $LINDERA_CACHE/${linderaVersion}/CC-CEDICT-MeCab-0.1.0-20200409.tar.gz
  '';
}
