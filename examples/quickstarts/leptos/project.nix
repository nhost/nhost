{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "leptos";
  version = "0.0.0-dev";
  submodule = "examples/quickstarts/${name}";

  fs = pkgs.lib.fileset;

  # A standalone crate that depends on the SDK by path, so it has its own
  # lockfile and therefore its own vendor directory.
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
    # rustc needs a linker (cc) to build proc-macros.
    pkgs.stdenv.cc
    pkgs.openssl
    pkgs.pkg-config
  ];

  src = fs.toSource {
    root = ../../..;
    fileset = fs.unions [
      ./Cargo.toml
      ./Cargo.lock
      ./src
      ./index.html
      ./README.md
      # The SDK sources the path dependency points at. `include` in the SDK's
      # Cargo.toml names README.md, so it has to be here too.
      ../../../packages/nhost-rust/Cargo.toml
      ../../../packages/nhost-rust/README.md
      ../../../packages/nhost-rust/src
    ];
  };
in
{
  devShell = pkgs.mkShell {
    buildInputs = checkDeps ++ [
      # Trunk is the WASM bundler / dev server the README tells you to use.
      pkgs.trunk
      pkgs.nhost.nhost-cli
    ];
  };

  # This example is the SDK's only browser/WASM consumer, so it is what proves
  # the `wasm` feature still builds for a real frontend. Checked on the
  # wasm32-unknown-unknown target, which is how it actually runs.
  check =
    pkgs.runCommand "${name}-tests"
      {
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

        echo "➜ Checking rustfmt"
        cargo fmt --check

        echo "➜ Running clippy (wasm32 browser target)"
        cargo clippy --offline --locked --all-targets \
          --target wasm32-unknown-unknown -- -D warnings

        mkdir $out
      '';
}
