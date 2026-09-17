{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "mcp";
  description = "Nhost MCP";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "services/${name}";

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
      (fs.fileFilter (f: f.hasExt "go") ../../cli/mcp/graphql)
      (fs.fileFilter (f: f.hasExt "go") ../../internal/lib/oapi/middleware)
    ];
  };

  tags = [ ];
  ldflags = [
    "-X main.Version=${version}"
  ];

  checkDeps = with pkgs; [
  ];

  buildInputs = [ ];

  nativeBuildInputs = [ ];
in
rec {
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
    buildInputs =
      with pkgs;
      [
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
  };

  dockerImage = nixops-lib.go.docker-image {
    inherit
      name
      package
      created
      version
      buildInputs
      ;

    # Ownership marker for the MCP Registry: before accepting a publish it pulls
    # the image referenced in server.json and requires this label to match the
    # `name` field there. Keep both in sync with services/mcp/server.json.
    config = {
      Labels = {
        "io.modelcontextprotocol.server.name" = "io.github.nhost/mcp";
      };
    };
  };
}
