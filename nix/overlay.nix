final: prev: rec {
  go = prev.go_1_21.overrideAttrs
    (finalAttrs: previousAttrs: rec {
      version = "1.21.5";

      src = final.fetchurl {
        url = "https://go.dev/dl/go${version}.src.tar.gz";
        sha256 = "sha256-KFy730tubmLtWPNw8/bYwwgl1uVsWFPGbTwjvNsJ2xk=";
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

  govulncheck = prev.govulncheck.override rec {
    buildGoModule = args: prev.buildGoModule.override { go = go; } (args // rec { });
  };

  gqlgenc = prev.gqlgenc.override rec {
    buildGoModule = args: prev.buildGoModule.override { go = go; } (args // rec {
      version = "0.16.2";
      src = prev.fetchFromGitHub {
        owner = "Yamashou";
        repo = "gqlgenc";
        rev = "v${version}";
        sha256 = "sha256-XNmCSkgJJ2notrv0Din4jlU9EoHJcznjEUiXQgQ5a7I=";
      };

      vendorHash = "sha256-6iwNykvW1m+hl6FzMNbvvPpBNp8OQn2/vfJLmAj60Mw=";
    });
  };

  mockgen = prev.mockgen.override rec {
    buildGoModule = args: final.buildGoModule (args // rec {
      version = "0.3.0";
      src = final.fetchFromGitHub {
        owner = "uber-go";
        repo = "mock";
        rev = "v${version}";
        sha256 = "sha256-pwlssqk/2aXTOwchePJK7CqEQ6lkQv7E+aT3HzUhvpE=";
      };
      vendorHash = "sha256-mcNVud2jzvlPPQEaar/eYZkP71V2Civz+R5v10+tewA=";
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
      "-Dheif=disabled"
      "-Djpeg-xl=disabled"
      "-Dpoppler=disabled"
      "-Drsvg=disabled"
      "-Dpangocairo=disabled"
    ];

  });

}
