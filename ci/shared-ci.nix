{
  pkgs,
  revision ? null,
}:
let
  paths = [
    ".github/workflows/wf_check.yaml"
    ".github/workflows/wf_docker_push_image_ecr.yaml"
    ".github/actions/setup-nix/action.yml"
    ".github/actions/cache-nix/action.yml"
    ".github/actions/cache-nix/cache.sh"
    ".github/actions/cache-nix/test_cache.py"
    "build/makefiles/general.makefile"
    "build/makefiles/release.makefile"
    "ci/tests/test_workflows.py"
    "ci/tests/test_shared_ci.py"
  ];
  source = pkgs.lib.fileset.toSource {
    root = ../.;
    fileset = pkgs.lib.fileset.unions (map (path: ../. + "/${path}") paths);
  };
  metadata = pkgs.writeText "ci-files-bundle.json" (
    builtins.toJSON {
      repository = "nhost/nhost";
      inherit revision;
      files = builtins.listToAttrs (
        map (path: {
          name = path;
          value = builtins.hashFile "sha256" (../. + "/${path}");
        }) paths
      );
    }
  );
  files = pkgs.runCommand "nhost-ci-files" { } ''
    mkdir -p "$out/files"
    cp -r ${source}/. "$out/files/"
    cp ${metadata} "$out/bundle.json"
  '';
in
{
  inherit files;
  sync = pkgs.writeShellApplication {
    name = "sync-ci";
    runtimeInputs = [ pkgs.python3 ];
    text = ''
      exec python3 ${./sync_ci.py} ${files} "$@"
    '';
  };
}
