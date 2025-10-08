{ self, pkgs, nix-filter, nixops-lib }:
let
  name = "cli";
  description = "Nhost CLI";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";
  submodule = "${name}";

  src = nix-filter.lib.filter {
    root = ./..;
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
      "${submodule}/get_access_token.sh"
      "${submodule}/gqlgenc.yaml"
      (inDirectory "${submodule}/ssl/.ssl")
      (inDirectory "${submodule}/cmd/config/testdata")
      (inDirectory "${submodule}/cmd/project/templates")
      (inDirectory "${submodule}/nhostclient/graphql/query/")

      "${submodule}/mcp/nhost/auth/openapi.yaml"
      "${submodule}/mcp/nhost/graphql/openapi.yaml"
      "${submodule}/mcp/resources/cloud_schema.graphql"
      "${submodule}/mcp/resources/cloud_schema-with-mutations.graphql"
      "${submodule}/mcp/resources/nhost_toml_schema.cue"
      (inDirectory "${submodule}/cmd/mcp/testdata")
      (inDirectory "${submodule}/mcp/graphql/testdata")
    ];
  };

  tags = [ ];
  ldflags = [
    "-X main.Version=${version}"
  ];

  checkDeps = with pkgs; [
    jq
    curl
    cacert
    gqlgenc
    oapi-codegen
  ];

  buildInputs = [ ];

  nativeBuildInputs = [ ];
in
rec {
  check = nixops-lib.go.check {
    inherit src submodule ldflags tags buildInputs nativeBuildInputs checkDeps;

    preCheck = ''
      echo "➜ Getting access token"
      export NHOST_ACCESS_TOKEN=$(bash ${src}/cli/get_access_token.sh)
    '';
  };

  devShell = nixops-lib.go.devShell {
    buildInputs = with pkgs; [
      certbot-full
      python312Packages.certbot-dns-route53
    ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  package = nixops-lib.go.package {
    inherit name description version src submodule ldflags buildInputs nativeBuildInputs;
  };

  dockerImage = nixops-lib.go.docker-image {
    inherit name package created version buildInputs;
  };

  cli-arm64-darwin = (nixops-lib.go.package {
    inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
  }).overrideAttrs (old: old // {
    env = {
      GOOS = "darwin";
      GOARCH = "arm64";
      CGO_ENABLED = "0";
    };
  });

  cli-amd64-darwin = (nixops-lib.go.package {
    inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
  }).overrideAttrs (old: old // {
    env = {
      GOOS = "darwin";
      GOARCH = "amd64";
      CGO_ENABLED = "0";
    };
  });

  cli-arm64-linux = (nixops-lib.go.package {
    inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
  }).overrideAttrs (old: old // {
    env = {
      GOOS = "linux";
      GOARCH = "arm64";
      CGO_ENABLED = "0";
    };
  });

  cli-amd64-linux = (nixops-lib.go.package {
    inherit name submodule description src version ldflags buildInputs nativeBuildInputs;
  }).overrideAttrs (old: old // {
    env = {
      GOOS = "linux";
      GOARCH = "amd64";
      CGO_ENABLED = "0";
    };
  });

  cli-multiplatform = pkgs.runCommand "cli-multiplatform-${version}"
    {
      meta = {
        description = "Multi-platform ${description} binaries";
      };
    } ''
    mkdir -p $out/{darwin,linux}/{arm64,amd64}

    cp ${cli-arm64-darwin}/bin/${name} $out/darwin/arm64/cli
    cp ${cli-amd64-darwin}/bin/${name} $out/darwin/amd64/cli
    cp ${cli-arm64-linux}/bin/${name} $out/linux/arm64/cli
    cp ${cli-amd64-linux}/bin/${name} $out/linux/amd64/cli
  '';
}
