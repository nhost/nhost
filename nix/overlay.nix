final: prev: rec {
  go = final.go_1_17;

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

  vips = (
    prev.vips.override { }
  ).overrideAttrs (
    oldAttrs: rec {
      version = "8.12.1";

      src = final.fetchFromGitHub {
        owner = "libvips";
        repo = "libvips";
        rev = "v${version}";
        sha256 = "sha256-Zo1Y4pYa+o55+ASrAiDUO7SAC4zpcAniEKkTFvIoU6o=";
        # Remove unicode file names which leads to different checksums on HFS+
        # vs. other filesystems because of unicode normalisation.
        extraPostFetch = ''
          rm -r $out/test/test-suite/images/
        '';
      };
    }
  );

}
