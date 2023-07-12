(final: prev: rec {

  go = prev.go_1_20.overrideAttrs
    (finalAttrs: previousAttrs: rec {
      version = "1.20.6";

      src = final.fetchurl {
        url = "https://go.dev/dl/go${version}.src.tar.gz";
        sha256 = "sha256-Yu5bxvtVuLro9wXgy434bWRTYmtOz5MnnihnCS4Lf3A=";
      };

    });

  buildGoModule = prev.buildGoModule.override { go = go; };

  golangci-lint = prev.golangci-lint.override rec {
    buildGoModule = args: final.buildGoModule (args // rec {
      version = "1.52.2";
      src = final.fetchFromGitHub {
        owner = "golangci";
        repo = "golangci-lint";
        rev = "v${version}";
        sha256 = "sha256-FmNXjOMDDdGxMQvy5f1NoaqrKFpmlPWclXooMxXP8zg=";
      };
      vendorHash = "sha256-BhD3a0LNc3hpiH4QC8FpmNn3swx3to8+6gfcgZT8TLg=";

      meta = with final.lib; args.meta // {
        broken = false;
      };
    });
  };

  golines = final.buildGoModule rec {
    name = "golines";
    version = "0.11.0";
    src = final.fetchFromGitHub {
      owner = "dbarrosop";
      repo = "golines";
      rev = "b7e767e781863a30bc5a74610a46cc29485fb9cb";
      sha256 = "sha256-pxFgPT6J0vxuWAWXZtuR06H9GoGuXTyg7ue+LFsRzOk=";
    };
    vendorHash = "sha256-rxYuzn4ezAxaeDhxd8qdOzt+CKYIh03A9zKNdzILq18=";

    meta = with final.lib; {
      description = "A golang formatter that fixes long lines";
      homepage = "https://github.com/segmentio/golines";
      maintainers = [ "nhost" ];
      platforms = platforms.linux ++ platforms.darwin;
    };
  };

  govulncheck = final.buildGoModule rec {
    name = "govulncheck";
    version = "latest";
    src = final.fetchFromGitHub {
      owner = "golang";
      repo = "vuln";
      rev = "95e65680c7fc66e75ce2dd502362b9b0e83801e9";
      sha256 = "sha256-XYiXOoJ1kyu2jKx0RJrbOBZDgRpgetrxIkuZpLuVmUM=";
    };
    vendorHash = "sha256-QB+TgKALueQiUFFq1jEzkY7zK1ifmlZ6ApneKhi4kTo=";

    doCheck = false;

    meta = with final.lib; {
      description = "the database client and tools for the Go vulnerability database";
      homepage = "https://github.com/golang/vuln";
      maintainers = [ "nhost" ];
      platforms = platforms.linux ++ platforms.darwin;
    };
  };

  gqlgenc = final.buildGoModule rec {
    pname = "gqlgenc";
    version = "0.13.5";

    src = final.fetchFromGitHub {
      owner = "Yamashou";
      repo = pname;
      rev = "v${version}";
      sha256 = "sha256-f4JkVYNLe93EO570k9MiBzOoGDSeJzY2dmM1yXbIE4k=";
    };

    vendorHash = "sha256-Up7Wi6z0Cbp9RHKAsjj/kd50UqcXtsS+ETRYuxRfGuA=";

    doCheck = false;

    subPackages = [ "./." ];

    meta = with final.lib; {
      description = "This is Go library for building GraphQL client with gqlgen";
      homepage = "https://github.com/Yamashou/gqlgenc";
      license = licenses.mit;
      maintainers = [ "@nhost" ];
    };
  };


})

