final: prev: rec {
  go = prev.go_1_24.overrideAttrs
    (finalAttrs: previousAttrs: rec {
      version = "1.24.9";

      src = final.fetchurl {
        url = "https://go.dev/dl/go${version}.src.tar.gz";
        sha256 = "sha256-xy+BulT+AO/n8+dJnUAJeSRogbE7d16am7hVQcEb5pU=";
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

  golines = final.buildGoModule rec {
    pname = "golines";
    version = "0.13.0-beta";
    src = final.fetchFromGitHub {
      owner = "segmentio";
      repo = "golines";
      rev = "fc305205784a70b4cfc17397654f4c94e3153ce4";
      sha256 = "sha256-ZdCR4ZC1+Llyt/rcX0RGisM98u6rq9/ECUuHEMV+Kkc=";
    };
    vendorHash = "sha256-mmdaHm3YL/2eB/r3Sskd9liljKAe3/c8T0z5KIUHeK0=";
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

  oapi-codegen = prev.oapi-codegen.overrideAttrs (oldAttrs: rec {
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
