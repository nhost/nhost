(
  final: prev:
  let
    biome_version = "2.5.11";
  in
  rec {
    # Node toolchain pinned ahead of nixpkgs, exposed only under `pkgs.nhost.*`
    # (see default.nix). Deliberately NOT exported as global
    # `nodejs`/`nodejs-slim_24`: overriding those globally taints every nixpkgs
    # package with node in its build closure (npm hooks, docs themes, scons,
    # ...), forcing source rebuilds of huge dependency cones instead of
    # substituting them from cache.nixos.org.
    nodejs-slim = prev.nodejs-slim_24.overrideAttrs (oldAttrs: rec {
      version = "24.20.0";
      src = prev.fetchurl {
        url = "https://nodejs.org/dist/v${version}/node-v${version}.tar.xz";
        sha256 = "sha256-JzL8P1iN0zXNZ3nAaGT3zUJLsbX/mhdDBZpmxU+cpKE=";
      };
      # nixpkgs pins Node 24.19.0 and carries two "update Ada to 4.0.0"
      # fetchpatch2 patches as a bridge until Ada 4.x lands upstream. Node
      # 24.20.0 already ships Ada 4.0.0, so both patches now fail with
      # "reversed (or previously applied) patch detected". Drop them from the
      # inherited patch set (match by commit hash in the fetched patch's name).
      patches = builtins.filter (
        p:
        !(builtins.any (h: prev.lib.hasInfix h (toString p)) [
          "eb1a49b0aec9e05cbb59f093d38f0a92818b7de1"
          "064e2eee1ec7b17c4bc6e36befc2935eee80d0f7"
        ])
      ) (oldAttrs.patches or [ ]);

      # nixpkgs runs the upstream `test-ci-js` suite during the build. Two tests
      # fail only inside the macOS Nix sandbox (they pass on Linux/hydra, where
      # the base package is built): test-dgram-connect-sync connects to
      # 127.0.0.2, which the sandbox denies with EPERM despite
      # __darwinAllowLocalNetworking; test-https-connect-localport hangs and
      # times out. Append both to CI_SKIP_TESTS on Darwin, matching how nixpkgs
      # already skips other Darwin-sandbox-only network tests.
      checkFlags = map (
        f:
        if prev.lib.hasPrefix "CI_SKIP_TESTS=" f then
          f
          + prev.lib.optionalString final.stdenv.buildPlatform.isDarwin ",test-dgram-connect-sync,test-https-connect-localport"
        else
          f
      ) oldAttrs.checkFlags;
    });

    nodejs = final.symlinkJoin {
      name = "nodejs";
      version = final.nhost.nodejs-slim.version;
      paths = [
        final.nhost.nodejs-slim
        npm_11
      ];

      passthru = {
        inherit (final.nhost.nodejs-slim)
          version
          python
          meta
          src
          ;

        pkgs = final.callPackage "${final.path}/pkgs/development/node-packages/default.nix" {
          nodejs = final.nhost.nodejs;
        };
      };
    };

    vercel =
      (import ./vercel {
        pkgs = final;
        nodejs = final.nhost.nodejs;
      })."vercel-53.3.2";

    npm_11 = final.stdenv.mkDerivation rec {
      pname = "npm";
      version = "11.19.0";
      src = final.fetchurl {
        url = "https://registry.npmjs.org/npm/-/npm-${version}.tgz";
        sha256 = "sha256-Mel3D33HERmlhQk1OyeRdVeq8KybXvGgRl7n2OxnrnU=";
      };
      nativeBuildInputs = [ final.nhost.nodejs-slim.out ];
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
        nodejs = final.nhost.nodejs;
        version = "11.24.0";
        hash = "sha256-0eqyQzFyZhzDahjshfzpP3cdsZYnFzKcwB7JwoJMok8=";
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

    biome = final.biome.overrideAttrs (
      finalAttrs: previousAttrs: {
        version = biome_version;

        src = final.fetchFromGitHub {
          owner = "biomejs";
          repo = "biome";
          rev = "@biomejs/biome@${biome_version}";
          hash = "sha256-8xiYWucmPrvvizvsAo1swmrJPiSdlvTdynM2c/+rJnI=";
        };

        cargoDeps = final.rustPlatform.fetchCargoVendor {
          inherit (finalAttrs) pname version src;
          hash = "sha256-cy29RkqgU1ok/MNc/KK7svRAr/vq/ntaQT43yJ5mrrA=";
        };
      }
    );

    # Pinned to match dashboard/package.json's @playwright/test; Chromium only.
    playwright-driver =
      let
        chromiumRevision = "1223";
        chromiumVersion = "148.0.7778.96";
        cft = path: "https://cdn.playwright.dev/builds/cft/${chromiumVersion}/${path}";
        components = prev.playwright-driver.components;
        chromium = components.chromium.overrideAttrs (_: {
          src = prev.fetchzip {
            url = cft "linux64/chrome-linux64.zip";
            stripRoot = true;
            hash = "sha256-TnplS4C/PPcmyWrMCqWh7c1KrpevHJFKO0gfh46M3tk=";
          };
        });
        chromium-headless-shell = components."chromium-headless-shell".overrideAttrs (_: {
          src = prev.fetchzip {
            url = cft "linux64/chrome-headless-shell-linux64.zip";
            stripRoot = false;
            hash = "sha256-Nr0/uczFTBTqvRPR0c/wflIqG5relgKfC9XsMOdE9iE=";
          };
        });
        browsers = prev.linkFarm "playwright-browsers" [
          {
            name = "chromium-${chromiumRevision}";
            path = chromium;
          }
          {
            name = "chromium_headless_shell-${chromiumRevision}";
            path = chromium-headless-shell;
          }
          {
            name = "ffmpeg-1011";
            path = components.ffmpeg;
          }
        ];
      in
      (prev.playwright-driver.overrideAttrs (old: rec {
        version = "1.60.0";
        src = prev.fetchFromGitHub {
          owner = "Microsoft";
          repo = "playwright";
          rev = "v${version}";
          hash = "sha256-jtQHyphdZsS8hf7uhe9zrx16Uf+kgLLha6dTCsCTT/8=";
        };
        npmDepsHash = "sha256-K1bCDURaq2+kaqGQcOL1tD6tQt/37pyDFWq2njUVNS4=";
      })).overrideAttrs
        (old: {
          passthru = old.passthru // {
            inherit browsers;
          };
        });

  }
)
