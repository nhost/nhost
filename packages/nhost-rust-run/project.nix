{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "nhost-rust-run";
  version = "0.0.0-dev";
  submodule = "packages/${name}";

  fs = pkgs.lib.fileset;

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
    # C toolchain: rustc needs a linker (cc) to build proc-macros and crates.
    pkgs.stdenv.cc
  ];

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ./Cargo.toml
      ./Cargo.lock
      ./README.md
      ./src
      ./tests
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

  # No backend needed (pure HTTP-server helper), so this runs hermetically.
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
        cargo clippy --offline --all-targets -- -D warnings

        echo "➜ Running tests"
        cargo test --offline

        mkdir $out
      '';

  package = pkgs.rustPlatform.buildRustPackage {
    pname = "nhost-run";
    inherit version;
    src = pkgSrc;
    cargoLock.lockFile = ./Cargo.lock;
    doCheck = false;
  };
}
