final: prev:
let
  version = "6.2.1";

  toolchains = {
    x86_64-linux = {
      platform = "ubuntu24.04";
      swiftArch = "x86_64";
      hash = "sha256-QCLLZPr34mgcGfm2KiL7fZBV22GU2eSkvvkQe2zhCUY=";
    };
    aarch64-linux = {
      platform = "ubuntu24.04-aarch64";
      swiftArch = "aarch64";
      hash = "sha256-O3CjsjuUNcNxEtlu4pqnAGHiMFnvnE08+klR9JxN/ts=";
    };
  };

  system = final.stdenv.hostPlatform.system;
  cfg =
    toolchains.${system} or (throw "swift_6 is only packaged for Linux; unsupported system: ${system}");
  platformPath = builtins.replaceStrings [ "." ] [ "" ] cfg.platform;
  gccLibDir = "${final.gcc.cc}/lib/gcc/${final.stdenv.hostPlatform.config}/${final.gcc.cc.version}";

  libeditCompat = final.runCommand "libedit-swift-compat" { } ''
    mkdir -p $out/lib
    ln -s ${final.libedit}/lib/libedit.so $out/lib/libedit.so.2
  '';
in
{
  swift_6 = final.stdenv.mkDerivation rec {
    pname = "swift";
    inherit version;

    src = final.fetchurl {
      url = "https://download.swift.org/swift-${version}-release/${platformPath}/swift-${version}-RELEASE/swift-${version}-RELEASE-${cfg.platform}.tar.gz";
      hash = cfg.hash;
    };

    nativeBuildInputs = [ final.autoPatchelfHook ];

    buildInputs = with final; [
      curl
      icu77
      libedit
      libeditCompat
      libxml2_13.out
      ncurses
      openssl
      python312
      sqlite
      stdenv.cc.cc.lib
      util-linuxMinimal.lib
      zlib
    ];

    dontConfigure = true;
    dontBuild = true;

    unpackPhase = ''
      runHook preUnpack
      tar -xzf $src --strip-components=1
      runHook postUnpack
    '';

    installPhase = ''
      runHook preInstall
      mkdir -p $out
      cp -R usr/. $out/
      runHook postInstall
    '';

    postFixup = ''
      swiftLibs="$out/lib/swift/linux:$out/lib/swift/pm/ManifestAPI:$out/lib/swift/host:$out/lib"
      cIncludePaths="${final.glibc.dev}/include:${final.util-linuxMinimal.dev}/include:$out/lib/swift/linux/${cfg.swiftArch}"
      libraryPaths="${final.glibc}/lib:${gccLibDir}:${final.stdenv.cc.cc.lib}/lib"
      swiftCArgs="-Xcc -I${final.glibc.dev}/include -Xcc -I${final.util-linuxMinimal.dev}/include -Xcc -I$out/lib/swift/linux/${cfg.swiftArch} -Xcc -fmodule-map-file=$out/lib/swift/linux/${cfg.swiftArch}/glibc.modulemap"

      substituteInPlace "$out/lib/swift/linux/${cfg.swiftArch}/glibc.modulemap" \
        --replace-fail 'textual header "assert.h"' 'textual header "${final.glibc.dev}/include/assert.h"'

      # SwiftPM's XCTest runner imports Testing when the module is visible, even
      # with --disable-swift-testing. The official 6.2.1 Linux toolchain ships
      # Testing/Foundation as a textual cross-import overlay that fails to rebuild
      # in Nix's non-FHS include layout, while XCTest itself works. Hide only the
      # cross-import overlay so XCTest-based tests remain usable in the sandbox.
      rm -rf "$out/lib/swift/linux/Testing.swiftcrossimport"

      mv "$out/bin/swift-driver" "$out/bin/.swift-driver-unwrapped"
      mv "$out/bin/swift-package" "$out/bin/.swift-package-unwrapped"
      mv "$out/bin/clang-17" "$out/bin/.clang-unwrapped"
      rm -f "$out/bin/clang" "$out/bin/clang++" "$out/bin/clang-17"

      wrapSwiftTool() {
        local tool="$1"
        local target="$2"
        local extraArgs="$3"
        rm -f "$out/bin/$tool"
        cat > "$out/bin/$tool" <<EOF
      #!${final.runtimeShell}
      export LD_LIBRARY_PATH="$swiftLibs:\''${LD_LIBRARY_PATH:-}"
      export PATH="$out/bin:\''${PATH:-}"
      export SWIFT_HOME="$out"
      export C_INCLUDE_PATH="$cIncludePaths:\''${C_INCLUDE_PATH:-}"
      export CPLUS_INCLUDE_PATH="$cIncludePaths:\''${CPLUS_INCLUDE_PATH:-}"
      export LIBRARY_PATH="$libraryPaths:\''${LIBRARY_PATH:-}"
      exec -a "$tool" "$target" "\$@" $extraArgs
      EOF
        chmod +x "$out/bin/$tool"
      }

      wrapSwiftcTool() {
        rm -f "$out/bin/swiftc"
        cat > "$out/bin/swiftc" <<EOF
      #!${final.runtimeShell}
      export LD_LIBRARY_PATH="$swiftLibs:\''${LD_LIBRARY_PATH:-}"
      export PATH="$out/bin:\''${PATH:-}"
      export SWIFT_HOME="$out"
      export C_INCLUDE_PATH="$cIncludePaths:\''${C_INCLUDE_PATH:-}"
      export CPLUS_INCLUDE_PATH="$cIncludePaths:\''${CPLUS_INCLUDE_PATH:-}"
      export LIBRARY_PATH="$libraryPaths:\''${LIBRARY_PATH:-}"
      for arg in "\$@"; do
        if [ "\$arg" = "-modulewrap" ]; then
          exec -a swiftc "$out/bin/.swift-driver-unwrapped" "\$@"
        fi
      done
      exec -a swiftc "$out/bin/.swift-driver-unwrapped" "\$@" $swiftCArgs
      EOF
        chmod +x "$out/bin/swiftc"
      }

      wrapClangTool() {
        local tool="$1"
        rm -f "$out/bin/$tool"
        cat > "$out/bin/$tool" <<EOF
      #!${final.runtimeShell}
      export C_INCLUDE_PATH="$cIncludePaths:\''${C_INCLUDE_PATH:-}"
      export CPLUS_INCLUDE_PATH="$cIncludePaths:\''${CPLUS_INCLUDE_PATH:-}"
      export LIBRARY_PATH="$libraryPaths:\''${LIBRARY_PATH:-}"
      exec -a "$tool" "$out/bin/.clang-unwrapped" \
        -B${final.stdenv.cc.bintools.bintools}/bin \
        -B${final.glibc}/lib \
        -B${gccLibDir} \
        -L${final.glibc}/lib \
        -L${gccLibDir} \
        -L${final.stdenv.cc.cc.lib}/lib \
        -Wl,-dynamic-linker=${final.stdenv.cc.bintools.dynamicLinker} \
        "\$@"
      EOF
        chmod +x "$out/bin/$tool"
      }

      wrapSwiftTool swift "$out/bin/.swift-driver-unwrapped" ""
      wrapSwiftcTool
      wrapSwiftTool swift-driver "$out/bin/.swift-driver-unwrapped" ""
      for tool in swift-build swift-test swift-run; do
        wrapSwiftTool "$tool" "$out/bin/.swift-package-unwrapped" "$swiftCArgs"
      done
      wrapSwiftTool swift-package "$out/bin/.swift-package-unwrapped" ""
      for tool in clang clang++ clang-17; do
        wrapClangTool "$tool"
      done
    '';

    passthru = {
      inherit (cfg) platform swiftArch;
    };

    meta = with final.lib; {
      description = "Swift.org ${version} toolchain packaged for Nhost Linux checks";
      homepage = "https://www.swift.org/download/";
      license = licenses.asl20;
      platforms = [
        "x86_64-linux"
        "aarch64-linux"
      ];
    };
  };

  swiftpm_6 = final.swift_6;
}
