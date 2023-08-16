final: prev: rec {
  go = prev.go_1_20.overrideAttrs (finalAttrs: previousAttrs: rec {
    version = "1.20.7";

    src = final.fetchurl {
      url = "https://go.dev/dl/go${version}.src.tar.gz";
      sha256 = "sha256-LF7pyeweczsNu8K9/tP2IwblHYFyvzj09OVCsnUg9Zc=";
    };

  });

  golangci-lint = prev.golangci-lint.override rec {
    buildGoModule = args: prev.buildGoModule.override { go = go; } (args // rec {
      version = "1.53.3";
      src = prev.fetchFromGitHub {
        owner = "golangci";
        repo = "golangci-lint";
        rev = "v${version}";
        sha256 = "sha256-5qTWYmr82BFuyA+lS1HwCHqdrtWScI6tuu0noRbali8=";
      };

      vendorHash = "sha256-MEfvBlecFIXqAet3V9qHRmeUzzcsSnkfM3HMTMlxss0=";

      ldflags = [
        "-s"
        "-w"
        "-X main.version=${version}"
        "-X main.commit=v${version}"
        "-X main.date=19700101-00:00:00"
      ];
    });
  };

  gqlgenc = prev.gqlgenc.override rec {
    buildGoModule = args: prev.buildGoModule.override { go = go; } (args // rec {
      version = "0.14.0";
      src = prev.fetchFromGitHub {
        owner = "Yamashou";
        repo = "gqlgenc";
        rev = "v${version}";
        sha256 = "sha256-0KUJlz8ey0kLmHO083ZPaJYIhInlKvO/a1oZYjPGopo=";
      };

      vendorHash = "sha256-Up7Wi6z0Cbp9RHKAsjj/kd50UqcXtsS+ETRYuxRfGuA=";
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
