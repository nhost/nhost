{ postgres
, pkgs
}:

args:

let
  # Import upstream builder
  # https://github.com/NixOS/nixpkgs/blob/nixpkgs-unstable/pkgs/servers/sql/postgresql/postgresqlBuildExtension.nix
  upstreamBuilder = pkgs.callPackage
    "${pkgs.path}/pkgs/servers/sql/postgresql/postgresqlBuildExtension.nix"
    { postgresql = postgres; };

in
upstreamBuilder (args // {
  nativeCheckInputs = [ postgres ] ++ args.nativeCheckInputs or [ ];
  nativeBuildInputs = [ pkgs.clang pkgs.removeReferencesTo ] ++ args.nativeBuildInputs or [ ];

  postInstall = args.postInstall or "" + ''
    # Remove bitcode files that contain references to build tools
    rm -rf "$out"/lib/bitcode 2>/dev/null || true

    # Strip references
    find "$out" -type f -exec remove-references-to -t ${postgres.pg_config} -t ${pkgs.clang} -t ${postgres.dev} {} + 2>/dev/null || true
  '';
})
