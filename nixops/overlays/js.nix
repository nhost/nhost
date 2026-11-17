(
  final: prev:
  let
    biome_version = "2.5.11";

    # Keep runtime overrides under `pkgs.nhost.*`. Overriding global nixpkgs
    # Node attrs taints unrelated build closures and defeats binary caches.
    mkNodejsSlim =
      {
        version,
        sha256,
        obsoletePatches ? [ ],
      }:
      prev.${"nodejs-slim_${prev.lib.versions.major version}"}.overrideAttrs (oldAttrs: {
        inherit version;
        src = prev.fetchurl {
          url = "https://nodejs.org/dist/v${version}/node-v${version}.tar.xz";
          inherit sha256;
        };
        patches = builtins.filter (
          p: !builtins.any (name: prev.lib.hasInfix name (toString p)) obsoletePatches
        ) (oldAttrs.patches or [ ]);

        # These releases expose Brotli error codes missing from nixpkgs' shared
        # library. Use the matching bundled Brotli without changing global deps.
        configureFlags = builtins.filter (
          flag: !(prev.lib.hasPrefix "--shared-brotli" flag)
        ) oldAttrs.configureFlags;
        buildInputs = builtins.filter (input: input != prev.brotli) oldAttrs.buildInputs;

        # These network tests fail only inside the macOS Nix sandbox:
        # 127.0.0.2 is denied with EPERM and the HTTPS local-port test hangs.
        checkFlags = map (
          f:
          if prev.lib.hasPrefix "CI_SKIP_TESTS=" f then
            f
            + prev.lib.optionalString final.stdenv.buildPlatform.isDarwin ",test-dgram-connect-sync,test-https-connect-localport"
          else
            f
        ) oldAttrs.checkFlags;
      });

    # Reuse nixpkgs' wrapper, including each release's bundled npm/corepack.
    # Unwrap nixpkgs' `lib.warn` from `nodejs.src` for source consumers.
    mkNodejs =
      nodejs-slim:
      (prev.${"nodejs_${prev.lib.versions.major nodejs-slim.version}"}.override {
        inherit nodejs-slim;
      }).overrideAttrs
        (oldAttrs: {
          passthru = oldAttrs.passthru // {
            inherit (nodejs-slim) src;
          };
        });
  in
  rec {
    nodejs-slim_22 = mkNodejsSlim {
      version = "22.23.4";
      sha256 = "7b9adc82d612d0a2a863d96c46de2292552e250cee51956ebbe0146c42aacae9";
      # The OpenSSL CCM test fix is already included upstream.
      obsoletePatches = [ "40eac4a32f3676b286fd44435be4514962a40b79" ];
    };
    nodejs-slim_24 = mkNodejsSlim {
      version = "24.22.1";
      sha256 = "4f5379796280cdaeb0c2f358fd04b6a16cc4fb7dfa83b5a8c91a9d963b435231";
      # The OpenSSL CCM test fix is already included upstream.
      obsoletePatches = [ "a37601c99d7bde9abb3b3ae57b2fb2bacd81ec9d" ];
    };
    nodejs-slim_26 = mkNodejsSlim {
      version = "26.12.1";
      sha256 = "053e3b296859b6d8d93f99ef97fa9cec1c4ee171c72968100c649978c1dbd38c";
      # Upstream now supports Temporal with system ICU directly.
      obsoletePatches = [ "fix-temporal-integration-with-shared-icu.patch" ];
    };

    nodejs_22 = mkNodejs nodejs-slim_22;
    nodejs_24 = mkNodejs nodejs-slim_24;
    nodejs_26 = mkNodejs nodejs-slim_26;
    nodejs-slim = nodejs-slim_24;
    nodejs = nodejs_24;

    vercel =
      (import ./vercel {
        pkgs = final;
        nodejs = final.nhost.nodejs;
      })."vercel-53.3.2";

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
