{ self, pkgs, nix-filter, nixops-lib }:
let
  name = "storage";
  description = "Nhost Storage";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "services/${name}";

  src = nix-filter.lib.filter {
    root = ../..;
    include = with nix-filter.lib;[
      "go.mod"
      "go.sum"
      (inDirectory "vendor")
      ".golangci.yaml"
      isDirectory
      (and
        (inDirectory submodule)
        (matchExt "go")
      )
      "${submodule}/gqlgenc.yaml"
      "${submodule}/controller/openapi.yaml"
      "${submodule}/api/types.cfg.yaml"
      "${submodule}/api/server.cfg.yaml"
      "${submodule}/metadata/metadata.graphql"

      "${submodule}/controller/openapi.yaml"
      "${submodule}/vacuum.yaml"
      "${submodule}/vacuum-ignore.yaml"

      (inDirectory "${submodule}/migrations/postgres")
      (inDirectory "${submodule}/clamd/testdata")
      (inDirectory "${submodule}/client/testdata")
      (inDirectory "${submodule}/image/testdata")
      (inDirectory "${submodule}/storage/testdata")

      (inDirectory ../../internal/lib/oapi)
      (inDirectory ../../internal/lib/hasura/metadata)
    ];

    exclude = with nix-filter.lib; [
      (inDirectory "${submodule}/build/dev/jwt-gen")
    ];
  };

  tags = [ ];
  ldflags = [
    "-X github.com/nhost/nhost/${submodule}/controller.buildVersion=${version}"
  ];

  checkDeps = with pkgs; [
    mockgen
    oapi-codegen
    gqlgenc
    vacuum-go
  ];

  x265-no-numa = pkgs.x265.overrideAttrs (oldAttrs: {
    cmakeFlags = (oldAttrs.cmakeFlags or [ ]) ++ [
      "-DENABLE_LIBNUMA=OFF"
    ];
  });

  libheif-no-numa = pkgs.libheif.override {
    x265 = x265-no-numa;
  };

  vips = pkgs.vips.overrideAttrs (oldAttrs: {
    outputs = [ "bin" "out" "man" "dev" ];
    buildInputs = with pkgs; [
      glib
      libxml2
      expat
      libjpeg
      libpng
      libwebp
      openjpeg
      pango
      libarchive
      libhwy
      libheif-no-numa
    ];
    mesonFlags = [
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
      "-Djpeg-xl=disabled"
      "-Dpoppler=disabled"
      "-Drsvg=disabled"
      "-Dpangocairo=disabled"
      "-Dheif=enabled"
      "-Duhdr=disabled"
      "-Draw=disabled"
    ];
  });

  buildInputs = [
    vips
  ];

  nativeBuildInputs = with pkgs; [
    clang
    pkg-config
  ];
in
rec {
  check = nixops-lib.go.check {
    inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;

    preCheck = ''
      export GIN_MODE=release
      export HASURA_AUTH_BEARER=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE5ODAwNTYxNTAsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiJdLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXVzZXItaWQiOiJhYjViYTU4ZS05MzJhLTQwZGMtODdlOC03MzM5OTg3OTRlYzIiLCJ4LWhhc3VyYS11c2VyLWlzQW5vbnltb3VzIjoiZmFsc2UifSwiaWF0IjoxNjY0Njk2MTUwLCJpc3MiOiJoYXN1cmEtYXV0aCIsInN1YiI6ImFiNWJhNThlLTkzMmEtNDBkYy04N2U4LTczMzk5ODc5NGVjMiJ9.OMVYu-30oOuUNZeSbzhP0u0pq5bf-U2Z49LWkqr3hyc
      export TEST_S3_ACCESS_KEY=5a7bdb5f42c41e0622bf61d6e08d5537
      export TEST_S3_SECRET_KEY=9e1c40c65a615a5b52f52aeeaf549944ec53acb1dff4a0bf01fb58e969f915c8

      echo "➜ Checking OpenAPI spec..."
      vacuum lint \
        -dqb -n info \
        --ruleset ${src}/${submodule}/vacuum.yaml \
        --ignore-file ${src}/${submodule}/vacuum-ignore.yaml \
        ${src}/${submodule}/controller/openapi.yaml
    '';
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = [
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  package = nixops-lib.go.package {
    inherit name description version src submodule ldflags buildInputs nativeBuildInputs;
  };

  dockerImage = nixops-lib.go.docker-image {
    inherit name package created version buildInputs;

    config = {
      Env = [
        "MALLOC_ARENA_MAX=2"
        "TMPDIR=/tmp"
        "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
      ];
    };
  };

  clamav-docker-image = pkgs.dockerTools.buildLayeredImage {
    name = "clamav";
    tag = version;
    created = "now";

    contents = with pkgs; [
      (writeTextFile {
        name = "tmp-file";
        text = ''
          dummy file to generate tmpdir
        '';
        destination = "/tmp/tmp-file";
      })
      (writeTextFile {
        name = "entrypoint.sh";
        text = pkgs.lib.fileContents ./build/clamav/entrypoint.sh;
        executable = true;
        destination = "/usr/local/bin/entrypoint.sh";
      })
      (writeTextFile {
        name = "freshclam.conf";
        text = pkgs.lib.fileContents ./build/clamav/freshclam.conf.tmpl;
        destination = "/etc/clamav/freshclam.conf.tmpl";
      })
      (writeTextFile {
        name = "clamd.conf";
        text = pkgs.lib.fileContents ./build/clamav/clamd.conf.tmpl;
        destination = "/etc/clamav/clamd.conf.tmpl";
      })
      envsubst
      clamav
      fakeNss
      dockerTools.caCertificates
    ] ++ lib.optionals stdenv.isLinux [
      busybox
    ];
    config = {
      Env = [
        "TMPDIR=/tmp"
      ];
      Entrypoint = [
        "/usr/local/bin/entrypoint.sh"
      ];
    };
  };
}

