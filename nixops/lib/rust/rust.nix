{ pkgs }:
let
  rustCheckDeps = with pkgs; [
    rustc
    cargo
    clippy
    rustfmt
    # rustc shells out to a linker to build proc-macros and test binaries.
    stdenv.cc
    # Crates wrapping C libraries (openssl-sys, ...) locate them via pkg-config.
    pkg-config
    openssl
    cargo-deny
    # cargo-deny fetches the RustSec advisory database over git.
    git
    # Its setup hook exports SSL_CERT_FILE, which the advisory fetch and any
    # check reaching a local backend both need.
    cacert
  ];

  # Every crate compiles from the sources vendored out of its committed
  # Cargo.lock, so a check never needs the network to resolve dependencies and
  # cannot silently drift from the lock.
  vendorSetup = cargoVendorDir: ''
    export CARGO_HOME="$HOME/cargo"
    mkdir -p "$CARGO_HOME"
    cat > "$CARGO_HOME/config.toml" <<EOF
    [source.crates-io]
    replace-with = "vendored-sources"
    [source.vendored-sources]
    directory = "${cargoVendorDir}"
    EOF
  '';

  # cargo-deny needs a dependency graph and a current advisory database, and
  # neither can come from the vendored offline sources: the graph is resolved
  # with cargo, the database is fetched into a throwaway CARGO_HOME so the
  # fetch cannot disturb the vendored one used to compile.
  auditStep =
    {
      auditFeatures,
      denyConfig,
    }:
    ''
      echo "➜ Resolving the locked dependency graph from vendored sources"
      cargo metadata --offline --locked ${auditFeatures} --format-version 1 \
        > "$TMPDIR/cargo-metadata.json"

      echo "➜ Fetching the current RustSec database and crates.io index"
      buildCargoHome="$CARGO_HOME"
      export CARGO_HOME="$TMPDIR/cargo-deny"
      mkdir -p "$CARGO_HOME"
      cargo deny --metadata-path "$TMPDIR/cargo-metadata.json" fetch db index

      echo "➜ Checking dependencies for security advisories"
      cargo deny --metadata-path "$TMPDIR/cargo-metadata.json" \
        ${pkgs.lib.optionalString (denyConfig != null) "--config ${denyConfig}"} \
        --locked --offline check advisories
      export CARGO_HOME="$buildCargoHome"
    '';
in
{
  devShell =
    {
      buildInputs ? [ ],
      shellHook ? "",
    }:
    pkgs.mkShell {
      buildInputs =
        (with pkgs; [
          gnumake
          nixfmt
        ])
        ++ rustCheckDeps
        ++ buildInputs;

      inherit shellHook;
    };

  # check runs the steps every Rust component in the repo shares: compile from
  # vendored sources, scan dependencies for advisories, verify formatting, deny
  # clippy warnings, and run the test suite. Component-specific work belongs in
  # preCheck (before the source is copied) or extraCheck (after), so no consumer
  # has to restate the boilerplate to add one step.
  check =
    {
      src,
      cargoLock,
      submodule ? "",
      buildInputs ? [ ],
      nativeBuildInputs ? [ ],
      checkDeps ? [ ],
      # Appended to `cargo clippy --offline --locked`. Override to point at
      # another target, e.g. "--all-targets --target wasm32-unknown-unknown".
      clippyArgs ? "--all-targets",
      # Set false for a crate whose tests cannot run on the build host, such as
      # a wasm-only frontend.
      runTests ? true,
      cargoTestArgs ? "",
      audit ? true,
      # Feature selection for the graph cargo-deny scans. The default audits
      # every optional dependency, not just the ones on by default.
      auditFeatures ? "--all-features",
      # Path to a deny.toml. When null, cargo-deny falls back to its own
      # defaults.
      denyConfig ? null,
      preCheck ? "",
      extraCheck ? "",
    }:
    pkgs.runCommand "rusttests"
      {
        # Checks that talk to the local backend started by `make dev-env-up`
        # have to reach outside the sandbox, and the advisory fetch needs the
        # network. Matching nixops-lib.go.check, this is unconditional so every
        # consumer behaves the same way.
        __noChroot = true;
        nativeBuildInputs = rustCheckDeps ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
      }
      ''
        set -eo pipefail
        export HOME=$(mktemp -d)

        ${preCheck}

        echo "➜ Source: ${src}"

        ${vendorSetup (pkgs.rustPlatform.importCargoLock { lockFile = cargoLock; })}

        cp -r ${src} src
        chmod +w -R src
        cd src/${submodule}

        ${pkgs.lib.optionalString audit (auditStep {
          inherit auditFeatures denyConfig;
        })}

        echo "➜ Checking rustfmt"
        cargo fmt --check

        echo "➜ Running clippy"
        cargo clippy --offline --locked ${clippyArgs} -- -D warnings

        ${pkgs.lib.optionalString runTests ''
          echo "➜ Running tests"
          cargo test --offline --locked ${cargoTestArgs}
        ''}

        ${extraCheck}

        mkdir $out
      '';
}
