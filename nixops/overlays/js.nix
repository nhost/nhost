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
      version = "24.21.0";
      src = prev.fetchurl {
        url = "https://nodejs.org/dist/v${version}/node-v${version}.tar.xz";
        sha256 = "sha256-pvVN77b9fIT0HboT1h546bTglhcSz2HylxXAX1ztlPw=";
      };
      # Node 24.21.0 includes the OpenSSL CCM test fix, so this inherited
      # patch no longer applies.
      patches = builtins.filter (
        p: !(prev.lib.hasInfix "a37601c99d7bde9abb3b3ae57b2fb2bacd81ec9d" (toString p))
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

    # Node 24.21.0 already bundles npm 11.19.0. Reuse nixpkgs' standard
    # nodejs wrapper to combine the slim runtime with its npm output.
    nodejs = prev.nodejs_24.override {
      nodejs-slim = final.nhost.nodejs-slim;
    };

    vercel =
      (import ./vercel {
        pkgs = final;
        nodejs = final.nhost.nodejs;
      })."vercel-53.3.2";

    # pnpm 12 is a Rust rewrite, so the Node-specific pnpm 11 workarounds are
    # no longer needed.
    pnpm = prev.pnpm_12;

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
