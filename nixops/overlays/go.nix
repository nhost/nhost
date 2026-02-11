final: prev: rec {
  go = prev.go_1_26.overrideAttrs
    (finalAttrs: previousAttrs: rec {
      version = "1.26.0";

      src = final.fetchurl {
        url = "https://go.dev/dl/go${version}.src.tar.gz";
        sha256 = "sha256-yRMqih9r0qpKrR10uCMdlSdJUEg6SVBlfubFbm6Bd5A=";
      };

    });

  buildGoModule = prev.buildGoModule.override { go = go; };

  golangci-lint = prev.golangci-lint.overrideAttrs (oldAttrs: rec {
    version = "2.8.0";
    src = prev.fetchFromGitHub {
      owner = "golangci";
      repo = "golangci-lint";
      rev = "v${version}";
      sha256 = "sha256-w6MAOirj8rPHYbKrW4gJeemXCS64fNtteV6IioqIQTQ=";
    };
    vendorHash = "sha256-/Vqo/yrmGh6XipELQ9NDtlMEO2a654XykmvnMs0BdrI=";
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
    version = "0.14.0";
    src = final.fetchFromGitHub {
      owner = "golangci";
      repo = "golines";
      rev = "v${version}";
      sha256 = "sha256-2eMndvzi1762iPc0tazQQqBb66VVAz1pBr+ow6JnSYY=";
    };
    vendorHash = "sha256-4MNSr1a6V88BYVwU+ZZ4kFOx3KKYbCC2v4Ypziln1LQ=";
    meta = with final.lib; {
      description = "A golang formatter that fixes long lines";
      homepage = "https://github.com/golangci/golines";
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
    version = "0.17.86";
    src = final.fetchFromGitHub {
      owner = "99designs";
      repo = "gqlgen";
      rev = "v${version}";
      sha256 = "sha256-3lN/hW2LpLUmm+w31XWOJb7rP3Wyk054WcKVwwQ8afs=";
    };
    vendorHash = "sha256-mOLFcbodgEn86ZV3mDeoBjoDVlYLo+7Gz930pi/KqAI=";
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
