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

  # The examples are standalone crates with their own lockfiles (they depend on
  # the SDK by path), so each needs its own vendor directory.
  exampleVendorDirs = {
    notes-cli = pkgs.rustPlatform.importCargoLock {
      lockFile = ./examples/notes-cli/Cargo.lock;
    };
    leptos = pkgs.rustPlatform.importCargoLock {
      lockFile = ./examples/leptos/Cargo.lock;
    };
  };

  rustDeps = [
    pkgs.rustc
    pkgs.cargo
    pkgs.clippy
    pkgs.rustfmt
  ];

  checkDeps = rustDeps ++ [
    codegen
    pkgs.cargo-deny
    # cargo-deny fetches the RustSec advisory database through git.
    pkgs.git
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
      ./deny.toml
      ./gen.sh
      ./README.md
      ./src
      ./tests
      # The examples are compiled by the check, so they cannot drift from the
      # SDK's API. Listed file by file to keep target/ and dist/ out of the
      # source closure.
      ./examples/notes-cli/Cargo.toml
      ./examples/notes-cli/Cargo.lock
      ./examples/notes-cli/src
      ./examples/leptos/Cargo.toml
      ./examples/leptos/Cargo.lock
      ./examples/leptos/src
      ../../services/auth/docs/openapi.yaml
      ../../services/storage/controller/openapi.yaml
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

        echo "➜ Resolving the locked all-features dependency graph from vendored sources"
        cargo metadata --offline --locked --all-features --format-version 1 \
          > "$TMPDIR/cargo-metadata.json"

        echo "➜ Fetching the current RustSec database and crates.io index"
        buildCargoHome="$CARGO_HOME"
        export CARGO_HOME="$TMPDIR/cargo-deny"
        mkdir -p "$CARGO_HOME"
        cargo deny --metadata-path "$TMPDIR/cargo-metadata.json" fetch db index

        echo "➜ Checking dependencies for security advisories"
        cargo deny --metadata-path "$TMPDIR/cargo-metadata.json" \
          --locked --offline check advisories
        export CARGO_HOME="$buildCargoHome"

        echo "➜ Checking rustfmt"
        cargo fmt --check

        echo "➜ Running clippy (default / rustls-tls)"
        cargo clippy --offline --lib --tests -- -D warnings

        echo "➜ Building with the native-tls (openssl) backend"
        cargo build --offline --lib --no-default-features --features native-tls

        echo "➜ Running clippy for the wasm/browser feature (including tests)"
        cargo clippy --offline --lib --tests --no-default-features --features wasm -- -D warnings

        echo "➜ Building the wasm32 browser target"
        cargo build --offline --target wasm32-unknown-unknown \
          --no-default-features --features wasm

        echo "➜ Running the offline unit tests (no backend)"
        cargo test --offline --lib --test unit

        echo "➜ Running the offline unit tests with the wasm/browser feature"
        cargo test --offline --test unit --no-default-features --features wasm

        echo "➜ Compiling the documentation examples"
        cargo test --offline --doc

        # The examples are what the tutorials and quickstarts are written
        # against, so a silently uncompilable example means stale docs. Each
        # one is a separate crate with its own lockfile, hence its own
        # CARGO_HOME pointing at its own vendor directory; the calls run in a
        # subshell so the SDK's CARGO_HOME survives for the steps below.
        check_example() {
          name=$1
          vendor=$2
          shift 2
          export CARGO_HOME="$HOME/cargo-$name"
          mkdir -p "$CARGO_HOME"
          cat > "$CARGO_HOME/config.toml" <<EOF
        [source.crates-io]
        replace-with = "vendored-sources"
        [source.vendored-sources]
        directory = "$vendor"
        EOF
          cd "examples/$name"
          cargo fmt --check
          cargo clippy --offline --locked --all-targets "$@" -- -D warnings
        }

        echo "➜ Checking the notes-cli example (native)"
        ( check_example notes-cli ${exampleVendorDirs.notes-cli} )

        echo "➜ Checking the Leptos example (wasm32 browser target)"
        ( check_example leptos ${exampleVendorDirs.leptos} \
            --target wasm32-unknown-unknown )

        echo "➜ Running the integration tests against the local backend"
        # --include-ignored, not --ignored: the latter runs ONLY ignored tests,
        # so an integration test added without #[ignore] would be filtered out
        # of CI and stay green.
        cargo test --offline --test integration -- --include-ignored

        mkdir $out
      '';

  # Consumed by the docs check: docs/project.nix stages this as the
  # `nhost-rust-doc` flake package so gen.sh's build_rustdoc only has to run
  # the Node transformer (there is no cargo in the docs sandbox).
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
