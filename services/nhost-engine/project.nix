{
  self,
  pkgs,
  nixops-lib,
  # vips is reused from the storage project so the cgo image pipeline links the
  # exact same libvips build; the engine embeds storage, so it needs it too.
  vips,
}:
let
  name = "nhost-engine";
  description = "Nhost unified service binary (auth, storage, constellation)";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "services/${name}";

  fs = pkgs.lib.fileset;

  # The engine links auth, storage and constellation, so its source closure is
  # the union of all three plus the shared internal libraries. Only Go sources
  # are needed for the build (each service's codegen inputs live behind
  # `go generate`, which the engine's submodule-scoped check never runs), plus
  # the assets those packages `go:embed` at compile time.
  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../go.mod
      ../../go.sum
      ../../vendor
      ../../.golangci.yaml
      ../../govulncheck.yaml

      (fs.fileFilter (f: f.hasExt "go") ./.)
      (fs.fileFilter (f: f.hasExt "go") ../auth)
      (fs.fileFilter (f: f.hasExt "go") ../storage)
      (fs.fileFilter (f: f.hasExt "go") ../constellation)

      # Shared internal libraries (Go + any embedded assets, e.g. hasura
      # metadata) consumed across the services.
      ../../internal/lib

      # Compile-time embedded assets.
      ../auth/email-templates
      ../auth/go/migrations/postgres
      ../storage/controller/openapi.yaml
      ../storage/migrations/postgres
    ];
  };

  tags = [ ];
  ldflags = [
    "-X main.Version=${version}"
  ];

  # The engine has no `go generate` directives of its own and its check is
  # scoped to `services/nhost-engine`, so it needs none of the per-service
  # codegen tools. Vulnerability scanning + lint + test are enough.
  checkDeps = [ ];

  buildInputs = [
    vips
  ];

  nativeBuildInputs =
    (with pkgs; [
      clang
      pkg-config
    ])
    ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
      pkgs.apple-sdk_14
    ];
in
rec {
  check = nixops-lib.go.check {
    inherit
      src
      submodule
      ldflags
      tags
      buildInputs
      nativeBuildInputs
      checkDeps
      ;

    # constellation relies on the experimental encoding/json v2; the engine
    # links it, so the whole build must enable the experiment.
    preCheck = ''
      export GOEXPERIMENT=jsonv2
      export GIN_MODE=release
    '';
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = [
    ]
    ++ checkDeps
    ++ buildInputs
    ++ nativeBuildInputs;

    shellHook = "export GOEXPERIMENT=jsonv2";
  };

  package =
    (nixops-lib.go.package {
      inherit
        name
        description
        version
        src
        submodule
        ldflags
        buildInputs
        nativeBuildInputs
        ;
    }).overrideAttrs
      (old: {
        env = (old.env or { }) // {
          GOEXPERIMENT = "jsonv2";
        };
      });

  dockerImage = nixops-lib.go.docker-image {
    inherit
      name
      package
      created
      version
      buildInputs
      ;

    config = {
      Env = [
        "MALLOC_ARENA_MAX=2"
        "TMPDIR=/tmp"
        "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
      ];
    };

    contents = with pkgs; [
      wget # do not remove, useful for docker healthchecks
    ];
  };
}
