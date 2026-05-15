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
    nodejs-slim_24 = prev.nodejs-slim_24.overrideAttrs (oldAttrs: rec {
      version = "24.13.0";
      src = prev.fetchurl {
        url = "https://nodejs.org/dist/v${version}/node-v${version}.tar.xz";
        sha256 = "sha256-Mg/pCcuzR9z1FiAeSWTvF3uBON+af4ENDVSVBIGzFYs=";
      };
    });

    nodejs = final.symlinkJoin {
      name = "nodejs";
      version = final.nodejs-slim_24.version;
      paths = [
        final.nodejs-slim_24
        npm_11
      ];

      passthru = {
        inherit (final.nodejs-slim_24)
          version
          python
          meta
          src
          ;

        pkgs = final.callPackage "${final.path}/pkgs/development/node-packages/default.nix" {
          nodejs = final.nodejs;
        };
      };
    };

    nodePackages = prev.nodejs.pkgs // {
      vercel =
        (import ./vercel {
          pkgs = final;
          nodejs = final.nodejs;
        })."vercel-53.3.2";
    };

    buildNpmPackage = prev.buildNpmPackage.override {
      nodejs = prev.nodejs;
    };

    npm_11 = final.stdenv.mkDerivation rec {
      pname = "npm";
      version = "11.7.0";
      src = final.fetchurl {
        url = "https://registry.npmjs.org/npm/-/npm-${version}.tgz";
        sha256 = "sha256-KS8ULcGowBGZujSgflfPAWwmDqLFm2Tz7uiqrnoudQQ=";
      };
      nativeBuildInputs = [ final.nodejs-slim_24.out ];
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
        });

    ell = prev.ell.overrideAttrs (oldAttrs: {
      doCheck = false;
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
