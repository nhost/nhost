final: prev: rec {
  go = final.go_1_18;

  golangci-lint = prev.golangci-lint.override rec {
    buildGoModule = args: prev.buildGoModule.override { go = go; } (args // rec {
      version = "1.44.0";
      src = prev.fetchFromGitHub {
        owner = "golangci";
        repo = "golangci-lint";
        rev = "v${version}";
        sha256 = "sha256-2hEru7fnc8v7F/RrOB3jFdfLPYLpm0OupzJP6iORs+U=";
      };
      vendorSha256 = "sha256-DLvhkTYCaXfNfehEgCNKSKlKaGHo623wBnEhNeTJbmQ=";
      ldflags = [
        "-s"
        "-w"
        "-X main.version=${version}"
        "-X main.commit=v${version}"
        "-X main.date=19700101-00:00:00"
      ];
    });
  };

  imagemagick = prev.imagemagick.override {
    bzip2 = null;
    zlib = null;
    libX11 = null;
    libXext = null;
    libXt = null;
    fontconfig = null;
    freetype = null;
    ghostscript = null;
    # libjpeg = null;
    djvulibre = null;
    lcms2 = null;
    openexr = null;
    libjxl = null;
    # libpng = null;
    liblqr1 = null;
    librsvg = null;
    # libtiff = null;
    # libxml2 = null;
    # openjpeg = null;
    # libwebp = null;
    libheif = null;
  };

}
