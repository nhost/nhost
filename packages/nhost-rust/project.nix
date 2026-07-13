{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-rust";
  version = "0.0.0-dev";
  submodule = "packages/${name}";

  fs = pkgs.lib.fileset;

  # codegen is the prebuilt binary; gen.sh prefers it over `go run`.
  codegen = self.packages.${pkgs.system}.codegen;

  # Vendored crates resolved from the committed Cargo.lock (no network needed
  # to compile in the sandbox).
  cargoVendorDir = pkgs.rustPlatform.importCargoLock {
    lockFile = ./Cargo.lock;
  };

  rustDeps = [
    pkgs.rustc
    pkgs.cargo
    pkgs.clippy
    pkgs.rustfmt
  ];

  checkDeps = rustDeps ++ [
    codegen
    # C toolchain: rustc needs a linker (cc) to build proc-macros and crates.
    pkgs.stdenv.cc
    # openssl + pkg-config let the `native-tls` feature build (openssl-sys).
    pkgs.openssl
    pkgs.pkg-config
    # CA bundle for the integration run (its setup hook sets SSL_CERT_FILE).
    pkgs.cacert
  ];

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ./Cargo.toml
      ./Cargo.lock
      ./.cargo/config.toml
      ./gen.sh
      ./README.md
      ./src
      ./tests
      ../../services/auth/docs/openapi.yaml
      ../../services/storage/controller/openapi.yaml
    ];
  };

  pkgSrc = fs.toSource {
    root = ./.;
    fileset = fs.unions [
      ./Cargo.toml
      ./Cargo.lock
      ./src
    ];
  };
in
{
  devShell = pkgs.mkShell {
    buildInputs = checkDeps ++ [ pkgs.nhost.nhost-cli ];
  };

  check =
    pkgs.runCommand "nhost-rust-tests"
      {
        # The integration tests talk to the local backend started by
        # `make dev-env-up`, so the check must run outside the sandbox.
        __noChroot = true;
        nativeBuildInputs = checkDeps;
      }
      ''
        set -eo pipefail
        export HOME=$(mktemp -d)
        export CARGO_HOME="$HOME/cargo"
        mkdir -p "$CARGO_HOME"
        cat > "$CARGO_HOME/config.toml" <<EOF
        [source.crates-io]
        replace-with = "vendored-sources"
        [source.vendored-sources]
        directory = "${cargoVendorDir}"
        EOF

        cp -r ${src} src
        chmod +w -R src
        cd src/${submodule}

        echo "➜ Checking generated clients are up to date (codegen + rustfmt)"
        cp src/auth/client.rs "$TMPDIR/auth.before"
        cp src/storage/client.rs "$TMPDIR/storage.before"
        sh ./gen.sh
        diff "$TMPDIR/auth.before" src/auth/client.rs \
          || (echo "❌ auth/client.rs is stale; run ./gen.sh" && exit 1)
        diff "$TMPDIR/storage.before" src/storage/client.rs \
          || (echo "❌ storage/client.rs is stale; run ./gen.sh" && exit 1)

        echo "➜ Checking rustfmt"
        cargo fmt --check

        echo "➜ Running clippy (default / rustls-tls)"
        cargo clippy --offline --lib --tests -- -D warnings

        echo "➜ Building with the native-tls (openssl) backend"
        cargo build --offline --lib --no-default-features --features native-tls

        echo "➜ Running clippy for the wasm/browser feature"
        cargo clippy --offline --lib --no-default-features --features wasm -- -D warnings

        echo "➜ Building the wasm32 browser target"
        cargo build --offline --target wasm32-unknown-unknown \
          --no-default-features --features wasm

        echo "➜ Running the offline unit tests (no backend)"
        cargo test --offline --test unit

        echo "➜ Running the integration tests against the local backend"
        export NHOST_LOCAL_BACKEND=1
        cargo test --offline --test integration

        mkdir $out
      '';

  package = pkgs.rustPlatform.buildRustPackage {
    pname = "nhost";
    inherit version;
    src = pkgSrc;
    cargoLock.lockFile = ./Cargo.lock;
    # Tests require a live backend and are exercised by `check`.
    doCheck = false;
  };

  # Emits the rustdoc JSON the docs build transforms into the reference pages.
  # The heavy compile (crate + deps) happens here, reusing the vendored crates
  # and toolchain, so the docs check only needs Node to run the transformer.
  rustDocJson =
    pkgs.runCommand "nhost-rust-doc"
      {
        nativeBuildInputs = rustDeps ++ [
          pkgs.stdenv.cc
          pkgs.openssl
          pkgs.pkg-config
        ];
      }
      ''
        export HOME=$(mktemp -d)
        export CARGO_HOME="$HOME/cargo"
        mkdir -p "$CARGO_HOME"
        cat > "$CARGO_HOME/config.toml" <<EOF
        [source.crates-io]
        replace-with = "vendored-sources"
        [source.vendored-sources]
        directory = "${cargoVendorDir}"
        EOF

        cp -r ${src} src
        chmod +w -R src
        cd src/${submodule}

        echo "➜ Generating rustdoc JSON"
        # rustdoc's JSON output is behind `-Z unstable-options`;
        # RUSTC_BOOTSTRAP=1 enables it on the stable toolchain.
        RUSTC_BOOTSTRAP=1 cargo rustdoc --offline --lib -- \
          -Z unstable-options --output-format json

        mkdir -p $out
        cp target/doc/nhost.json $out/nhost.json
      '';
}
