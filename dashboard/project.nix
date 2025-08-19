{ self, pkgs, nix-filter, nixops-lib }:
let
  name = "codegen";
  description = "Codegen";
  version = "0.0.0-dev";
  submodule = "tools/${name}";

  src = nix-filter.lib.filter {
    root = ../..;
    include = with nix-filter.lib;[
      "go.mod"
      "go.sum"
      (inDirectory "vendor")
      "${submodule}/.golangci.yaml"
      isDirectory
      (and
        (inDirectory submodule)
        (matchExt "go")
      )
      (and
        (inDirectory submodule)
        (matchExt "tmpl")
      )
      (inDirectory "${submodule}/processor/testdata")
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
    inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;
  };

  devShell = pkgs.mkShell {
    buildInputs = with pkgs; [
      nhost-cli
      nodejs
      pnpm_10
    ];

    shellHook = ''
      rm -rf node_modules
      ln -sf ${self.node_modules}/node_modules/ node_modules

      rm -rf dashboard/node_modules
      ln -sf ${self.node_modules}/dashboard/node_modules/ dashboard/node_modules
    '';
  };


  package = nixops-lib.go.package {
    inherit name description version src submodule ldflags buildInputs nativeBuildInputs;
  };
}

