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

  # The Rust toolchain, cargo-deny, and the C/openssl/CA dependencies every
  # crate check needs come from nixops-lib.rust; only the codegen binary is
  # specific to this package.
  checkDeps = [ codegen ];

  # The library covers checks and dev shells, not builds, so the rustdoc output
  # below brings its own toolchain and vendored sources.
  rustDeps = [
    pkgs.rustc
    pkgs.cargo
  ];

  cargoVendorDir = pkgs.rustPlatform.importCargoLock {
    lockFile = ./Cargo.lock;
  };

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ./Cargo.toml
      ./Cargo.lock
      ./deny.toml
      ./gen.sh
      ./README.md
      ./src
      ./tests
      ../../services/auth/docs/openapi.yaml
      ../../services/storage/controller/openapi.yaml
    ];
  };
in
{
  devShell = nixops-lib.rust.devShell {
    buildInputs = checkDeps ++ [ pkgs.nhost.nhost-cli ];
  };

  check = nixops-lib.rust.check {
    inherit src submodule checkDeps;

    cargoLock = ./Cargo.lock;
    denyConfig = ./deny.toml;

    # The shared clippy and test steps cover the default (rustls-tls) feature
    # set; the other three feature sets are checked in extraCheck below.
    clippyArgs = "--lib --tests";
    cargoTestArgs = "--lib --test unit";

    # Regenerating in place would leave the working copy formatted by whichever
    # rustfmt this check pinned, so gen.sh runs against a throwaway copy and the
    # committed clients are compared to its output.
    preCheck = ''
      echo "➜ Checking generated clients are up to date (codegen + rustfmt)"
      mkdir -p $TMPDIR/gen
      cp -r ${src}/* $TMPDIR/gen
      chmod +w -R $TMPDIR/gen
      sh $TMPDIR/gen/${submodule}/gen.sh
      diff ${src}/${submodule}/src/auth/client.rs $TMPDIR/gen/${submodule}/src/auth/client.rs \
        || (echo "❌ auth/client.rs is stale; run ./gen.sh" && exit 1)
      diff ${src}/${submodule}/src/storage/client.rs $TMPDIR/gen/${submodule}/src/storage/client.rs \
        || (echo "❌ storage/client.rs is stale; run ./gen.sh" && exit 1)
      echo ""
    '';

    # This crate ships four feature sets and only one of them is the default, so
    # the remaining three are compiled and tested here. The integration suite
    # needs the local backend and so cannot live in the shared test step.
    extraCheck = ''
      echo "➜ Building with the native-tls (openssl) backend"
      cargo build --offline --locked --lib --no-default-features --features native-tls

      echo "➜ Running clippy for the wasm/browser feature (including tests)"
      cargo clippy --offline --locked --lib --tests \
        --no-default-features --features wasm -- -D warnings

      echo "➜ Building the wasm32 browser target"
      cargo build --offline --locked --target wasm32-unknown-unknown \
        --no-default-features --features wasm

      echo "➜ Running the offline unit tests with the wasm/browser feature"
      cargo test --offline --locked --test unit --no-default-features --features wasm

      echo "➜ Compiling the documentation examples"
      cargo test --offline --locked --doc

      # The examples that exercise this SDK live under examples/ and have
      # their own checks (nhost-rust-tutorial, leptos), so they are compiled
      # against the SDK there rather than here.

      echo "➜ Running the integration tests against the local backend"
      # --include-ignored, not --ignored: the latter runs ONLY ignored tests,
      # so an integration test added without #[ignore] would be filtered out
      # of CI and stay green.
      cargo test --offline --locked --test integration -- --include-ignored
    '';
  };

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
