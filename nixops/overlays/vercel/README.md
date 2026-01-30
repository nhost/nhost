# Vercel Nix Overlay

This directory contains [node2nix](https://github.com/svanderburg/node2nix)-generated Nix expressions for the Vercel CLI.

## Upgrading

1. Update the version in `node-packages.json`:

   ```json
   [{"vercel": "<NEW_VERSION>"}]
   ```

2. Regenerate the Nix expressions:

   ```sh
   cd nixops/overlays/vercel
   nix-shell -p node2nix --run "node2nix --pkg-name nodejs_22 -i node-packages.json"
   ```

3. Add esbuild platform binaries. node2nix does not resolve esbuild's platform-specific
   optional dependencies (`@esbuild/<platform>`), so they must be added manually to
   `node-packages.nix`:

   a. Add source entries for each platform (check the esbuild version used by vercel):

      ```nix
      "@esbuild/darwin-arm64-<VERSION>" = {
        name = "_at_esbuild_slash_darwin-arm64";
        packageName = "@esbuild/darwin-arm64";
        version = "<VERSION>";
        src = fetchurl {
          url = "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-<VERSION>.tgz";
          sha512 = "<HASH>";
        };
      };
      ```

      Repeat for `darwin-x64`, `linux-arm64`, and `linux-x64`. You can get the sha512
      hashes from `https://registry.npmjs.org/@esbuild/<platform>/<version>`.

   b. Add them to the vercel package's `dependencies` list, next to the `esbuild` entry:

      ```nix
      sources."esbuild-<VERSION>"
      sources."@esbuild/darwin-arm64-<VERSION>"
      sources."@esbuild/darwin-x64-<VERSION>"
      sources."@esbuild/linux-arm64-<VERSION>"
      sources."@esbuild/linux-x64-<VERSION>"
      ```

4. Update the attribute name in `nixops/overlays/js.nix` if the version changed:

   ```nix
   nodePackages = prev.nodejs.pkgs // {
     vercel = (import ./vercel {
       pkgs = final;
       nodejs = final.nodejs;
     })."vercel-<NEW_VERSION>";
   };
   ```

5. Test:

   ```sh
   nix develop .#vercel -c vercel --version
   ```
