{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-rust-tutorial";
  version = "0.0.0-dev";
  submodule = "examples/tutorials/${name}";

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
    # rustc needs a linker (cc) to build proc-macros and crates.
    pkgs.stdenv.cc
    # openssl + pkg-config in case a dependency pulls in openssl-sys.
    pkgs.openssl
    pkgs.pkg-config
  ];

  # Rooted at the repo so the `nhost = { path = "../../../packages/nhost-rust" }`
  # dependency resolves. Listed file by file to keep target/ out of the closure.
  src = fs.toSource {
    root = ../../..;
    fileset = fs.unions [
      ./Cargo.toml
      ./Cargo.lock
      ./src
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
    buildInputs = checkDeps ++ [ pkgs.nhost.nhost-cli ];
  };

  # The tutorial pages are written against this crate, so an example that stops
  # compiling against the SDK means the docs have gone stale. Compiling it here
  # is what keeps that from happening silently.
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

        echo "➜ Running clippy"
        cargo clippy --offline --locked --all-targets -- -D warnings

        mkdir $out
      '';
}
