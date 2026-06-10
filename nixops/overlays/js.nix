(
  final: prev:
  let
    biome_version = "2.4.15";
    biome_dist = {
      aarch64-darwin = {
        url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-darwin-arm64";
        sha256 = "0ym19wd6yzpzpj6inydsfc5xzakl6w7g4lj1dihd1z5hnc0mdimj";
      };
      x86_64-darwin = {
        url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-darwin-x64";
        sha256 = "0zd0508kdx6bs4cly6jhny1k96g8wy07ybwmn8hghf2aqnfs7f7s";
      };
      aarch64-linux = {
        url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-linux-arm64";
        sha256 = "1bp2adhhszz38p6izszhbxk9w54vq9lm8m007yj91f9nva9dbf3y";
      };
      x86_64-linux = {
        url = "https://github.com/biomejs/biome/releases/download/%40biomejs%2Fbiome%40${biome_version}/biome-linux-x64";
        sha256 = "001m5xy2riy2yj3mjf5bq4ywydm0i8dbxlqvx8q35l5gkrry5bwd";
      };
    };
  in
  rec {
    # Node toolchain pinned ahead of nixpkgs, scoped to our own packages (and
    # the dev shell via project.nix). Deliberately NOT exported as
    # `nodejs`/`nodejs-slim_24`: overriding those globally taints every nixpkgs
    # package with node in its build closure (npm hooks, docs themes, scons,
    # ...), forcing source rebuilds of huge dependency cones instead of
    # substituting them from cache.nixos.org.
    nodejs-slim-pinned = prev.nodejs-slim_24.overrideAttrs (oldAttrs: rec {
      version = "24.16.0";
      src = prev.fetchurl {
        url = "https://nodejs.org/dist/v${version}/node-v${version}.tar.xz";
        sha256 = "sha256-L/hKbecLYWUpARGw/GVt7RrSB6eZgW/nIMx8MSMt8w8=";
      };
      # The TLS test patch (dd25d8f2…) was upstreamed in Node 24.16.0, so the
      # nixpkgs patch no longer applies. Drop it from the inherited patch set.
      patches = builtins.filter (
        p: !(prev.lib.hasInfix "dd25d8f29d3ddadcf5a5ebfdf98ece55f9df96c6" (toString p))
      ) (oldAttrs.patches or [ ]);
    });

    nodejs-pinned = final.symlinkJoin {
      name = "nodejs";
      version = final.nodejs-slim-pinned.version;
      paths = [
        final.nodejs-slim-pinned
        npm_11
      ];

      passthru = {
        inherit (final.nodejs-slim-pinned)
          version
          python
          meta
          src
          ;

        pkgs = final.callPackage "${final.path}/pkgs/development/node-packages/default.nix" {
          nodejs = final.nodejs-pinned;
        };
      };
    };

    vercel =
      (import ./vercel {
        pkgs = final;
        nodejs = final.nodejs-pinned;
      })."vercel-53.3.2";

    npm_11 = final.stdenv.mkDerivation rec {
      pname = "npm";
      version = "11.7.0";
      src = final.fetchurl {
        url = "https://registry.npmjs.org/npm/-/npm-${version}.tgz";
        sha256 = "sha256-KS8ULcGowBGZujSgflfPAWwmDqLFm2Tz7uiqrnoudQQ=";
      };
      nativeBuildInputs = [ final.nodejs-slim-pinned.out ];
      dontBuild = true;
      installPhase = ''
        mkdir -p $out/lib/node_modules/npm
        cp -r . $out/lib/node_modules/npm
        mkdir -p $out/bin
        ln -s $out/lib/node_modules/npm/bin/npm-cli.js $out/bin/npm
        ln -s $out/lib/node_modules/npm/bin/npx-cli.js $out/bin/npx
        patchShebangs $out/lib/node_modules/npm/bin
      '';
    };

    pnpm =
      (final.callPackage "${final.path}/pkgs/development/tools/pnpm/generic.nix" {
        version = "11.1.0";
        hash = "sha256-VzyCrTVuiwl+bKxIG3OB+d7tM6MYr38xGYSFjr4fl+8=";
      }).overrideAttrs
        (oldAttrs: {
          # In pnpm 11, bin/pnpm.cjs is a non-executable compatibility shim; the
          # real entrypoint moved to bin/pnpm.mjs. Upstream generic.nix still
          # symlinks to pnpm.cjs, which yields "permission denied" at runtime.
          installPhase = ''
            runHook preInstall

            install -d $out/{bin,libexec}
            cp -R . $out/libexec/pnpm
            ln -s $out/libexec/pnpm/bin/pnpm.mjs $out/bin/pnpm
            ln -s $out/libexec/pnpm/bin/pnpx.mjs $out/bin/pnpx

            runHook postInstall
          '';

          # macOS-only: Node's worker_threads fd tracker (trackUnmanagedFds, on
          # by default) races under pnpm's parallel workers and aborts the
          # process ("File descriptor N opened in unmanaged mode" then
          # SIGABRT/SIGKILL). pnpm churns fds via graceful-fs' EAGAIN retry loop;
          # libuv recycles those numbers for internal pipes, and worker-exit
          # cleanup then closes fds it doesn't own. Disable the tracker on pnpm's
          # WorkerPool. The --replace-fail target is minified and pinned to this
          # pnpm version; revisit it on the next pnpm bump. Remove once fixed
          # upstream: https://github.com/NixOS/nixpkgs/issues/525627
          postPatch =
            (oldAttrs.postPatch or "")
            + final.lib.optionalString final.stdenv.isDarwin ''
              substituteInPlace dist/pnpm.mjs \
                --replace-fail \
                  'resourceLimits: this._workerResourceLimits' \
                  'resourceLimits: this._workerResourceLimits, trackUnmanagedFds: false'
            '';
        });

    biome = final.stdenv.mkDerivation {
      pname = "biome";
      version = biome_version;

      src = final.fetchurl {
        inherit
          (biome_dist.${final.stdenvNoCC.hostPlatform.system}
            or (throw "Unsupported system: ${final.stdenvNoCC.hostPlatform.system}")
          )
          url
          sha256
          ;
      };

      dontUnpack = true;

      installPhase = ''
        mkdir -p $out/bin
        cp $src $out/bin/biome
        chmod +x $out/bin/biome
      '';
    };

  }
)
