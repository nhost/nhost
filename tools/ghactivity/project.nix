{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "gh-activity";
  description = "gh CLI extension that generates a markdown report of a user's GitHub activity in an org over a time range";
  version = "0.0.0-dev";
  submodule = "tools/ghactivity";

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ../..;
    fileset = fs.unions [
      ../../go.mod
      ../../go.sum
      ../../vendor
      ../../.golangci.yaml
      ../../govulncheck.yaml
      (fs.fileFilter (f: f.hasExt "go") ./.)
    ];
  };

  tags = [ ];
  ldflags = [
    "-X main.Version=${version}"
  ];

  checkDeps = [ ];

  buildInputs = [ ];

  nativeBuildInputs = [ ];
in
{
  check = nixops-lib.go.check {
    inherit
      src
      submodule
      ldflags
      tags
      buildInputs
      nativeBuildInputs
      checkDeps
      ;
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = [
      pkgs.gh # for local `gh extension install --force .` workflow
    ]
    ++ checkDeps
    ++ buildInputs
    ++ nativeBuildInputs;
  };

  package = nixops-lib.go.package {
    inherit
      name
      description
      version
      src
      submodule
      ldflags
      buildInputs
      nativeBuildInputs
      ;
    # Go names the binary after the subpackage's last path segment (`ghactivity`),
    # but this tool is meant to be installed as a `gh` extension, which discovers
    # binaries by the `gh-<name>` prefix. Rename to match.
    postInstall = ''
      mv $out/bin/ghactivity $out/bin/gh-activity
    '';
  };
}
