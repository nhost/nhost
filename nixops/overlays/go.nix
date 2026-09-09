final: prev:
let
  fs = final.lib.fileset;
in
rec {
  # Go toolchain pinned ahead of nixpkgs, exposed only under `pkgs.nhost.*`
  # (see default.nix). Deliberately NOT exported as global `go` /
  # `buildGoModule`: overriding those globally taints every nixpkgs package
  # with go in its build closure (even libcap), forcing source rebuilds of
  # huge dependency cones instead of substituting them from cache.nixos.org.
  go = prev.go_1_27.overrideAttrs (
    finalAttrs: previousAttrs: rec {
      version = "1.27.0";

      src = final.fetchurl {
        url = "https://go.dev/dl/go${version}.src.tar.gz";
        sha256 = "sha256-cAJAPXzERSnvbSb2mkSBgmM5Xq18FsBaWAiuBH6+sOU=";
      };

    }
  );

  buildGoModule = prev.buildGoModule.override { inherit go; };

  mockgen = final.nhost.buildGoModule rec {
    pname = "mockgen";
    version = "0.6.0";

    src = final.fetchFromGitHub {
      owner = "uber-go";
      repo = "mock";
      tag = "v${version}";
      hash = "sha256-gYUL+ucnKQncudQDcRt8aDqM7xE5XSKHh4X0qFrvfGs=";
    };

    vendorHash = "sha256-Cf7lKfMuPFT/I1apgChUNNCG2C7SrW7ncF8OusbUs+A=";

    subPackages = [ "mockgen" ];

    ldflags = [
      "-X=main.version=${version}"
      "-X=main.date=1970-01-01T00:00:00Z"
      "-X=main.commit=${src.rev}"
    ];

    doInstallCheck = true;

    meta = {
      description = "Mocking framework for the Go programming language";
      homepage = "https://github.com/uber-go/mock";
      changelog = "https://github.com/uber-go/mock/blob/v${version}/CHANGELOG.md";
      mainProgram = "mockgen";
    };
  };

  golangci-lint = final.nhost.buildGoModule rec {
    pname = "golangci-lint";
    version = "2.13.1";
    src = final.fetchFromGitHub {
      owner = "golangci";
      repo = "golangci-lint";
      rev = "v${version}";
      sha256 = "sha256-8nWHSMAwIILfKMPfxWKMimxWt9N+kUsZEAaoAOPbRBE=";
    };
    vendorHash = "sha256-yZRqfht5rY2yyoZNtYttE57sB7EYjk71yrKw8dLYzNk=";
    subPackages = [ "cmd/golangci-lint" ];
    ldflags = [
      "-s"
      "-w"
      "-X main.version=${version}"
      "-X main.commit=v${version}"
      "-X main.date=19700101-00:00:00"
    ];
    doCheck = false;
  };

  golines = final.nhost.buildGoModule rec {
    pname = "golines";
    version = "0.15.0";
    src = final.fetchFromGitHub {
      owner = "golangci";
      repo = "golines";
      rev = "v${version}";
      sha256 = "sha256-gjm76dGbFTisQdiM0GAQJRcAreQUWIBuqYbLU2ruCNk=";
    };
    vendorHash = "sha256-cLzCpjifb0lc6UaDW2JZBQABixz98EJ4syLapX7I8y8=";
    meta = with final.lib; {
      description = "A golang formatter that fixes long lines";
      homepage = "https://github.com/golangci/golines";
      maintainers = [ "nhost" ];
      platforms = platforms.linux ++ platforms.darwin;
    };
  };

  govulncheck = final.nhost.buildGoModule rec {
    pname = "govulncheck";
    version = "1.1.4";
    src = final.fetchFromGitHub {
      owner = "golang";
      repo = "vuln";
      rev = "v${version}";
      sha256 = "sha256-d1JWh/K+65p0TP5vAQbSyoatjN4L5nm3VEA+qBSrkAA=";
    };
    vendorHash = "sha256-MSTKDeWVxD2Fa6fNoku4EwFwC90XZ5acnM67crcgXDg=";
    subPackages = [ "cmd/govulncheck" ];
    doCheck = false;
  };

  gqlgen = prev.gqlgen.overrideAttrs (oldAttrs: rec {
    version = "0.17.91";
    src = final.fetchFromGitHub {
      owner = "99designs";
      repo = "gqlgen";
      rev = "v${version}";
      sha256 = "sha256-z4VCso3IxV8R9ov9qeyO9UH7DqExe1ybJF6eTaV7odI=";
    };
    vendorHash = "sha256-jOwBUeDPOctjeJGIEH7TxcNWX4jF/j1DyNk+FKrLQMQ=";
    doCheck = false;
  });

  gqlgenc = final.nhost.buildGoModule rec {
    pname = "gqlgenc";
    version = "0.38.2";
    src = final.fetchFromGitHub {
      owner = "gqlgo";
      repo = pname;
      rev = "v${version}";
      sha256 = "sha256-zb7hXGULyaLYEhcoJhirzlQCBblO3kPhCjp3obT6XTc=";
    };
    vendorHash = "sha256-aEujwQJ1rvKzuIZnN/sTD+mmp3FEDSOUwPqKGgYX89Y=";
    doCheck = false;
    subPackages = [ "./." ];
    meta = with final.lib; {
      description = "This is Go library for building GraphQL client with gqlgen";
      homepage = "https://github.com/gqlgo/gqlgenc";
      license = licenses.mit;
      maintainers = [ "@nhost" ];
    };
  };

  govulncheck-wrapper = final.nhost.buildGoModule {
    pname = "govulncheck-wrapper";
    version = "0.0.0-dev";
    src = fs.toSource {
      root = ../..;
      fileset = fs.unions [
        ../../go.mod
        ../../go.sum
        ../../vendor
        (fs.fileFilter (f: f.hasExt "go") ../../tools/govulncheck-wrapper)
      ];
    };
    vendorHash = null;
    subPackages = [ "tools/govulncheck-wrapper" ];
    doCheck = false;
  };

  sqlc = prev.sqlc.overrideAttrs (oldAttrs: rec {
    postInstall = "";
    doInstallCheck = false;
  });

  oapi-codegen = prev.oapi-codegen.overrideAttrs (oldAttrs: rec {
    version = "2.7.1";
    src = final.fetchFromGitHub {
      owner = "oapi-codegen";
      repo = "oapi-codegen";
      rev = "v${version}";
      hash = "sha256-Yfw4hb5EOYvBxl95OpUdLS+ZfCi5cHhHUf2LPS9xp0U=";
    };
    vendorHash = "sha256-ecO8nmegFAvhsvMaQ3W0wCwqbF2jUn48nSIvQGhwwcc=";
  });
}
