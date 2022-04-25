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

  vips = prev.vips.overrideAttrs (oldAttrs: rec {
    buildInputs = [
      final.glib
      final.libxml2
      final.expat
      final.libjpeg
      final.libpng
      final.libwebp
      final.openjpeg
    ];
  });

}
