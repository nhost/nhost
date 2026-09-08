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

  src = fs.toSource {
    root = ../../..;
    fileset = fs.unions [
      ./Cargo.toml
      ./Cargo.lock
      ./deny.toml
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
  devShell = nixops-lib.rust.devShell {
    buildInputs = [
      # Trunk is the WASM bundler / dev server the README tells you to use.
      pkgs.trunk
      pkgs.nhost.nhost-cli
    ];
  };

  # This example is the SDK's only browser/WASM consumer, so it is what proves
  # the `wasm` feature still builds for a real frontend. Checked on the
  # wasm32-unknown-unknown target, which is how it actually runs.
  #
  # It has its own lockfile, and a frontend dependency tree the SDK does not
  # otherwise pull in, so it is scanned for advisories separately.
  check = nixops-lib.rust.check {
    inherit src submodule;

    cargoLock = ./Cargo.lock;
    denyConfig = ./deny.toml;

    clippyArgs = "--all-targets --target wasm32-unknown-unknown";

    # A wasm-only frontend: its test targets cannot run on the build host.
    runTests = false;
  };
}
