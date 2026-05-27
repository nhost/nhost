{
  pkgs,
  nix2containerPkgs,
  nixops-lib,
}:
let
  name = "nixops";
  version = "0.0.0-dev";
  created = "1970-01-01T00:00:00Z";

  fs = pkgs.lib.fileset;

  src = fs.toSource {
    root = ../.;
    fileset = fs.unions [
      ../flake.lock
      ../flake.nix
      (fs.fileFilter (f: f.hasExt "nix") ./.)
    ];
  };

  checkDeps = [ ];

  # we use this to just build and cache the packages.
  # this list is the union of all `buildInputs`, `checkDeps`, and
  # `nativeBuildInputs` referenced by every `project.nix` in the repo,
  # plus the per-devShell extras (e.g. `go-migrate` from auth, `certbot-*`
  # from cli) and the root `flake.nix` devShell extras (`gh`, `git-cliff`,
  # `gnused`, `nixfmt`), so a single `nix build .#nixops` warms the cache
  # for every project's dev-shell and `make check`.
  buildInputs =
    (with pkgs; [
      biome
      bun
      cacert
      certbot-full
      clang
      curl
      diffutils
      docker-client
      gh
      git-cliff
      gnused
      go
      go-migrate
      gofumpt
      golangci-lint
      golines
      govulncheck
      gqlgen
      gqlgenc
      jq
      lychee
      mockgen
      nhost-cli
      nixfmt
      nodejs
      nodePackages.vercel
      oapi-codegen
      pkg-config
      playwright-driver
      pnpm
      postgresql_18
      postgresql_18-client
      python312Packages.certbot-dns-route53
      skopeo
      sqlc
      vacuum-go
      vale
      wal-g
    ])
    ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
    ]
    ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
      pkgs.apple-sdk_14
    ];

  nativeBuildInputs = [ ];

  user = "user";
  group = "user";
  uid = "1000";
  gid = "1000";

  l = pkgs.lib // builtins;

  mkUser = pkgs.runCommand "mkUser" { } ''
    mkdir -p $out/etc/pam.d

    echo "${user}:x:${uid}:${gid}::" > $out/etc/passwd
    echo "${user}:!x:::::::" > $out/etc/shadow

    echo "${group}:x:${gid}:" > $out/etc/group
    echo "${group}:x::" > $out/etc/gshadow

    cat > $out/etc/pam.d/other <<EOF
    account sufficient pam_unix.so
    auth sufficient pam_rootok.so
    password requisite pam_unix.so nullok sha512
    session required pam_unix.so
    EOF

    touch $out/etc/login.defs
    mkdir -p $out/home/${user}
  '';

  tmpFolder = (
    pkgs.writeTextFile {
      name = "tmp-file";
      text = ''
        dummy file to generate tmpdir
      '';
      destination = "/tmp/tmp-file";
    }
  );

  nixConfig = pkgs.writeTextFile {
    name = "nix-config";
    text = ''
      sandbox = false
      sandbox-fallback = false
      experimental-features = nix-command flakes
      trusted-users = root ${user}
    '';
    destination = "/etc/nix/nix.conf";
  };
in
{
  check = nixops-lib.nix.check { inherit src; };

  devShell = pkgs.mkShell {
    buildInputs = checkDeps ++ buildInputs ++ nativeBuildInputs;
  };

  package = pkgs.stdenv.mkDerivation {
    inherit name version src;

    nativeBuildInputs = nativeBuildInputs;
    buildInputs = buildInputs;

    installPhase = ''
      mkdir -p $out
      cp -r ${src} $out/
    '';
  };

  dockerImage = pkgs.runCommand "image-as-dir" { } ''
    ${
      (nix2containerPkgs.nix2container.buildImage {
        inherit name created;
        tag = version;
        maxLayers = 100;

        initializeNixDatabase = true;
        nixUid = l.toInt uid;
        nixGid = l.toInt gid;

        copyToRoot = [
          (pkgs.buildEnv {
            name = "image";
            paths = [
              (pkgs.buildEnv {
                name = "root";
                paths = with pkgs; [
                  coreutils
                  nixVersions.nix_2_28
                  bash
                  gnugrep
                  gnumake
                ];
                pathsToLink = [
                  "/bin"
                ];
              })
            ];
          })
          nixConfig
          tmpFolder
          mkUser
        ];

        perms = [
          {
            path = mkUser;
            regex = "/home/${user}";
            mode = "0744";
            uid = l.toInt uid;
            gid = l.toInt gid;
            uname = user;
            gname = group;
          }
          {
            path = tmpFolder;
            regex = "/tmp";
            mode = "0777";
            uid = l.toInt uid;
            gid = l.toInt gid;
            uname = user;
            gname = group;
          }
        ];

        config = {
          User = "user";
          WorkingDir = "/home/user";
          Env = [
            "NIX_PAGER=cat"
            "USER=nobody"
            "HOME=/home/user"
            "TMPDIR=/tmp"
            "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
          ];
        };

        layers = [
          (nix2containerPkgs.nix2container.buildLayer {
            deps = buildInputs;
          })
        ];

      }).copyTo
    }/bin/copy-to dir:$out
  '';
}
