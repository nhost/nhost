{ self, pkgs, nix-filter, nixops-lib }:
let
  name = "mcp";
  description = "Nhost MCP";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "services/${name}";

  src = nix-filter.lib.filter {
    root = ../..;
    include = with nix-filter.lib;[
      "go.mod"
      "go.sum"
      (inDirectory "vendor")
      ".golangci.yaml"
      isDirectory
      (and
        (inDirectory submodule)
        (matchExt "go")
      )
      (and
        (inDirectory "cli/mcp/graphql")
        (matchExt "go")
      )
      (and
        (inDirectory "internal/lib/oapi/middleware")
        (matchExt "go")
      )
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
    inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = with pkgs; [
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  package = nixops-lib.go.package {
    inherit name description version src submodule ldflags buildInputs nativeBuildInputs;
  };

  dockerImage = nixops-lib.go.docker-image {
    inherit name package created version buildInputs;
  };
}
