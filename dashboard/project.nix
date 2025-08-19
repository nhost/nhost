{ self, pkgs, nix2containerPkgs, nix-filter, nixops-lib, mkNodeDevShell, node_modules }:
let
  name = "dashboard";
  version = "0.0.0-dev";
  submodule = "${name}";

  src = nix-filter.lib.filter {
    root = ../.;
    include = with nix-filter.lib; [
      isDirectory
      (matchName "package.json")
      ".npmrc"
      "pnpm-workspace.yaml"
      "pnpm-lock.yaml"
      "turbo.json"
      (inDirectory "dashboard")
    ];

    exclude = with nix-filter.lib; [
      (matchName "node_modules")
      (matchName ".next")
      (matchExt "nix")
    ];
  };

  checkDeps = with pkgs; [ nhost-cli ];

  buildInputs = with pkgs; [ nodejs ];

  nativeBuildInputs = with pkgs; [ pnpm cacert ];
in
rec {
  devShell = mkNodeDevShell {
    buildInputs = [ ] ++ checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  entrypoint = pkgs.writeScriptBin "docker-entrypoint.sh" (builtins.readFile ./docker-entrypoint.sh);

  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = with pkgs; [ pnpm cacert nodejs ];
    buildInputs = with pkgs; [ nodejs ];
    dontFixup = true;

    buildPhase = ''
      pnpm install --frozen-lockfile

      pnpm build:dashboard
    '';

    installPhase = ''
      cd dashboard

      cp -r .next/standalone $out

      mkdir -p $out/dashboard/.next
      cp -r .next/static $out/dashboard/.next/static
      cp -r public $out/dashboard/public
    '';
  };

  dockerImage = pkgs.runCommand "image-as-dir" { } ''
    ${(nix2containerPkgs.nix2container.buildImage {
      inherit name;
      tag = version;
      # created
      maxLayers = 100;
      # arch

      copyToRoot = pkgs.buildEnv {
        name = "image";
        paths = [
          package
          (pkgs.writeTextFile {
            name = "tmp-file";
            text = ''
              dummy file to generate tmpdir
            '';
            destination = "/tmp/tmp-file";
          })
          pkgs.busybox
        ];
      };

      config = {
        Env = [
          "TMPDIR=/tmp"
          "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
          "NEXT_TELEMETRY_DISABLED=1"
          "NEXT_PUBLIC_ENV=dev"
          "NEXT_PUBLIC_NHOST_PLATFORM=false"
          # placeholders for URLs, will be replaced on runtime by entrypoint script
          "NEXT_PUBLIC_NHOST_ADMIN_SECRET=__NEXT_PUBLIC_NHOST_ADMIN_SECRET__"
          "NEXT_PUBLIC_NHOST_AUTH_URL=__NEXT_PUBLIC_NHOST_AUTH_URL__"
          "NEXT_PUBLIC_NHOST_FUNCTIONS_URL=__NEXT_PUBLIC_NHOST_FUNCTIONS_URL__"
          "NEXT_PUBLIC_NHOST_GRAPHQL_URL=__NEXT_PUBLIC_NHOST_GRAPHQL_URL__"
          "NEXT_PUBLIC_NHOST_STORAGE_URL=__NEXT_PUBLIC_NHOST_STORAGE_URL__"
          "NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL=__NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL__"
          "NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL=__NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL__"
          "NEXT_PUBLIC_NHOST_HASURA_API_URL=__NEXT_PUBLIC_NHOST_HASURA_API_URL__"
          "NEXT_PUBLIC_NHOST_CONFIGSERVER_URL=__NEXT_PUBLIC_NHOST_CONFIGSERVER_URL__"
        ];
        Entrypoint = [
          "${entrypoint}/bin/docker-entrypoint.sh" "${pkgs.nodejs}/bin/node" "/dashboard/server.js"
        ];
      };
    }).copyTo}/bin/copy-to dir:$out
  '';
}

