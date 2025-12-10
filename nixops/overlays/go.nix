final: prev: rec {
  go = prev.go_1_25.overrideAttrs
    (finalAttrs: previousAttrs: rec {
      version = "1.25.5";

      src = final.fetchurl {
        url = "https://go.dev/dl/go${version}.src.tar.gz";
        sha256 = "sha256-IqX9CpHvzSihsFNxBrmVmygEth9Zw3WLUejlQpwalU8=";
      };

    });

  buildGoModule = prev.buildGoModule.override { go = go; };

  golangci-lint = prev.golangci-lint.overrideAttrs (oldAttrs: rec {
    version = "2.3.0";
    src = prev.fetchFromGitHub {
      owner = "golangci";
      repo = "golangci-lint";
      rev = "v${version}";
      sha256 = "sha256-Kr4nkoqlCGyuaa4X1BLqe/WZA+ofYkWPizPMzcZQDQg=";
    };
    vendorHash = "sha256-SsKypfsr1woHah9rIyFnUNdp0mTde7k++E2CfE22LK4=";
    ldflags = [
      "-s"
      "-w"
      "-X main.version=${version}"
      "-X main.commit=v${version}"
      "-X main.date=19700101-00:00:00"
    ];
  });

  golines = final.buildGoModule {
    pname = "golines";
    version = "0.14.0-beta";
    src = final.fetchFromGitHub {
      owner = "segmentio";
      repo = "golines";
      rev = "8f32f0f7e89c30f572c7f2cd3b2a48016b9d8bbf";
      sha256 = "sha256-Y4q3xpGw8bAi87zJ48+LVbdgOc7HB1lRdYhlsF1YcVA=";
    };
    vendorHash = "sha256-94IXh9iBAE0jJXovaElY8oFdXE6hxYg0Ww0ZEHLnEwc=";
    meta = with final.lib; {
      description = "A golang formatter that fixes long lines";
      homepage = "https://github.com/segmentio/golines";
      maintainers = [ "nhost" ];
      platforms = platforms.linux ++ platforms.darwin;
    };
  };

  govulncheck = prev.govulncheck.overrideAttrs (oldAttrs: rec {
    version = "v1.1.4";
    src = final.fetchFromGitHub {
      owner = "golang";
      repo = "vuln";
      rev = "${version}";
      sha256 = "sha256-d1JWh/K+65p0TP5vAQbSyoatjN4L5nm3VEA+qBSrkAA=";
    };
    vendorHash = "sha256-MSTKDeWVxD2Fa6fNoku4EwFwC90XZ5acnM67crcgXDg=";
    doCheck = false;
  });

  gqlgen = prev.gqlgen.overrideAttrs (oldAttrs: rec {
    version = "0.17.76";
    src = final.fetchFromGitHub {
      owner = "99designs";
      repo = "gqlgen";
      rev = "v${version}";
      sha256 = "sha256-b226pRpO693e48OlzVwSaDlPM5RAivIoX/KHXESVEJI=";
    };
    vendorHash = "sha256-cqNRfKPneq4BxVA+kGAxSalwfeNI/hFxsrOgVhkUbLs=";
    doCheck = false;
  });

  gqlgenc = final.buildGoModule rec {
    pname = "gqlgenc";
    version = "0.33.0";
    src = final.fetchFromGitHub {
      owner = "Yamashou";
      repo = pname;
      rev = "v${version}";
      sha256 = "sha256-SLFfLt41MAGcyHG/XVWehaXGknOJbWltVWG+IYUHCz8=";
    };
    vendorHash = "sha256-Y2miO13zTW8VWA7vUbfQxTPbZvaaq+fNsKKNFw8iYJY=";
    doCheck = false;
    subPackages = [ "./." ];
    meta = with final.lib; {
      description = "This is Go library for building GraphQL client with gqlgen";
      homepage = "https://github.com/Yamashou/gqlgenc";
      license = licenses.mit;
      maintainers = [ "@nhost" ];
    };
  };

  oapi-codegen = prev.oapi-codegen.overrideAttrs (oldAttrs: {
    version = "2.6.0-beta0";
    src = final.fetchFromGitHub {
      owner = "dbarrosop";
      repo = "oapi-codegen";
      rev = "6225e75bb76ba1fa15113a7fc6aace55ad12862c";
      hash = "sha256-sXmHVIFKxnogdr9qULZ2Io7cQGG6sMMx0ZLskjz1mOc=";
    };
    vendorHash = "sha256-obpY7ZATebI/7bkPMidC83xnN60P0lZsJhSuKr2A5T4=";
  });
}
