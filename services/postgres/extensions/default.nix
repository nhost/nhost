{ pkgs
, postgres
}:
let
  inherit (pkgs) lib;
  buildPGXSExtension = import ./build_pgxs_extension.nix { inherit pkgs postgres; };

  buildPGRXExtension = attrs:
    (pkgs.buildPgrxExtension) (attrs // {
      postgresql = postgres;
    });

  extensionFiles = builtins.attrNames (builtins.readDir ./.);

  # Filter out any non-.nix files, default.nix, and build_* files
  extensionPaths =
    map (fname: ./. + "/${fname}")
      (builtins.filter
        (n:
          lib.hasSuffix ".nix" n &&
          n != "default.nix" &&
          !(lib.hasPrefix "build_" n)
        )
        extensionFiles);

  # Import all extensions
  extensions = map
    (path: pkgs.callPackage path {
      inherit pkgs buildPGXSExtension buildPGRXExtension postgres;
    })
    extensionPaths;

in
extensions
