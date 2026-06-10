{ pkgs }:
let
  swiftCheckDeps = with pkgs; [
    swift_6
  ];
in
{
  toolchain = pkgs.swift_6;

  devShell =
    {
      buildInputs ? [ ],
      checkDeps ? [ ],
      nativeBuildInputs ? [ ],
      shellHook ? "",
    }:
    pkgs.mkShell {
      buildInputs = swiftCheckDeps ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
      inherit shellHook;
    };

  check =
    {
      src,
      packagePath ? ".",
      buildInputs ? [ ],
      checkDeps ? [ ],
      nativeBuildInputs ? [ ],
      preCheck ? "",
      extraCheck ? "",
    }:
    pkgs.runCommand "swifttests"
      {
        # integration tests need network access to reach the dev-env backend
        # started on the host via `make dev-env-up` (CI runs nix with
        # sandbox = relaxed); same approach as nixops/lib/js/js.nix
        __noChroot = true;
        nativeBuildInputs = swiftCheckDeps ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
      }
      ''
        export HOME=$(mktemp -d)

        echo "➜ Source: ${src}"
        cp -r ${src} src
        chmod +w -R src
        cd src/${packagePath}

        ${preCheck}

        echo "➜ Verifying Swift toolchain"
        swift --version

        echo "➜ Building Swift package"
        swift build -v

        echo "➜ Testing Swift package"
        swift test --disable-swift-testing -v

        ${extraCheck}

        mkdir $out
      '';

  package =
    {
      name,
      version,
      src,
      packagePath ? ".",
      buildInputs ? [ ],
      nativeBuildInputs ? [ ],
    }:
    pkgs.stdenv.mkDerivation {
      inherit name version src;

      nativeBuildInputs = swiftCheckDeps ++ nativeBuildInputs;
      inherit buildInputs;

      buildPhase = ''
        export HOME=$(mktemp -d)

        cd ${packagePath}
        swift build -c release -v
      '';

      installPhase = ''
        mkdir -p $out
        cp -R .build $out/build
      '';
    };
}
