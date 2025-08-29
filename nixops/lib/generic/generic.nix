{ pkgs, nix2containerPkgs }:
let
  dockerImageFn =
    { name
    , tag
    , created
    , fromImage ? ""
    , copyToRoot ? null
    , maxLayers ? 100
    , config ? { }
    , arch ? pkgs.go.GOARCH
    }:
    nix2containerPkgs.nix2container.buildImage {
      inherit name tag created copyToRoot fromImage maxLayers config arch;
    };
in
{
  docker-image =
    { name
    , tag
    , created
    , fromImage ? ""
    , copyToRoot ? null
    , maxLayers ? 100
    , config ? { }
    , arch ? pkgs.go.GOARCH
    }:
    pkgs.runCommand "image-as-dir" { } ''
      ${(dockerImageFn {
        inherit name tag created fromImage copyToRoot maxLayers config arch;
      }).copyTo}/bin/copy-to dir:$out
    '';
}
