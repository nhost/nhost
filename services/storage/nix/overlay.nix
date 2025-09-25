final: prev: rec {
  oapi-codegen = prev.oapi-codegen.override {
    buildGoModule = args: final.buildGoModule (args // rec {
      version = "2.5.0-beta01";
      src = prev.fetchFromGitHub {
        owner = "dbarrosop";
        repo = "oapi-codegen";
        rev = "1ad6f36b618b60c577f9f9eb1018c97b64762514";
        sha256 = "sha256-+qtiKwCpFBo5d8l6cUCHE655oszU1ZYizJ2prCEF8dI=";
      };

      vendorHash = "sha256-xPBf5Jt70A1P3/9MJI/zyYGiiwM/Tpl7V+THa5e4lLQ=";
    });
  };

  vips = prev.vips.overrideAttrs (oldAttrs: rec {
    outputs = [ "bin" "out" "man" "dev" ];
    buildInputs = [
      final.glib
      final.libxml2
      final.expat
      final.libjpeg
      final.libpng
      final.libwebp
      final.openjpeg
      final.pango
      final.libarchive
      final.libhwy
      final.libheif
    ];
    mesonFlags = [
      "-Dgtk_doc=false"
      "-Dcgif=disabled"
      "-Dspng=disabled"
      "-Dpdfium=disabled"
      "-Dnifti=disabled"
      "-Dfftw=disabled"
      "-Dmagick=disabled"
      "-Dcfitsio=disabled"
      "-Dimagequant=disabled"
      "-Dquantizr=disabled"
      "-Dexif=disabled"
      "-Dtiff=disabled"
      "-Dopenslide=disabled"
      "-Dmatio=disabled"
      "-Dlcms=disabled"
      "-Dopenexr=disabled"
      "-Dorc=disabled"
      "-Djpeg-xl=disabled"
      "-Dpoppler=disabled"
      "-Drsvg=disabled"
      "-Dpangocairo=disabled"
      "-Dheif=enabled"
    ];

  });

}
