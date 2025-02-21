final: prev: rec {
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
