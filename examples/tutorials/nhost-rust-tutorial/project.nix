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
  devShell = nixops-lib.rust.devShell {
    buildInputs = [ pkgs.nhost.nhost-cli ];
  };

  # The tutorial pages are written against this crate, so an example that stops
  # compiling against the SDK means the docs have gone stale. Compiling it here
  # is what keeps that from happening silently.
  #
  # It is a standalone crate with its own lockfile, so its dependencies are
  # resolved and scanned for advisories separately from the SDK's: an example
  # is code users copy, and it should not be the one place a vulnerable
  # dependency goes unnoticed.
  check = nixops-lib.rust.check {
    inherit src submodule;

    cargoLock = ./Cargo.lock;

    # The crate has no tests of its own; clippy --all-targets already compiles
    # every target, which is what this check exists to prove.
    runTests = false;
  };
}
