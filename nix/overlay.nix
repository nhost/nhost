final: prev: rec {
  go = final.go_1_20;

  golangci-lint = prev.golangci-lint.override rec {
    buildGoModule = args: prev.buildGoModule.override { go = go; } (args // rec {
      version = "1.53.3";
      src = prev.fetchFromGitHub {
        owner = "golangci";
        repo = "golangci-lint";
        rev = "v${version}";
        sha256 = "sha256-5qTWYmr82BFuyA+lS1HwCHqdrtWScI6tuu0noRbali8=";
      };
      ldflags = [
        "-s"
        "-w"
        "-X main.version=${version}"
        "-X main.commit=v${version}"
        "-X main.date=19700101-00:00:00"
      ];
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
    ];
    mesonFlags = [
      "-Dgtk_doc=false"
      "-Dcgif=disabled"
      "-Dspng=disabled"
      "-Dpdfium=disabled"
      "-Dnifti=disabled"
      "-Dgsf=disabled"
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
      "-Dheif=disabled"
      "-Djpeg-xl=disabled"
      "-Dpoppler=disabled"
      "-Drsvg=disabled"
      "-Dpangocairo=disabled"
    ];

  });

}
