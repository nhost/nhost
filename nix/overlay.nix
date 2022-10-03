final: prev: rec {
  go = final.go_1_19;

  golangci-lint = prev.golangci-lint.override rec {
    buildGoModule = args: prev.buildGoModule.override { go = go; } (args // rec {
      version = "1.49.0";
      src = prev.fetchFromGitHub {
        owner = "golangci";
        repo = "golangci-lint";
        rev = "v${version}";
        sha256 = "sha256-L2PtDiMtT+vcMU4uW3GYZexLtDqnHRuUts7bIh/g0YA=";
      };
      vendorSha256 = "sha256-VPkOFUwp0Bm/YyBCbfQTa+R1bjau7Ai+p/TbgNxeejc=";
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
