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
      nhost.biome
      bun
      cacert
      nhost.certbot-full
      clang
      curl
      diffutils
      dnsutils
      docker-client
      geos
      gh
      git-cliff
      gnused
      nhost.go
      go-migrate
      gofumpt
      nhost.golangci-lint
      nhost.golines
      nhost.govulncheck
      nhost.gqlgen
      nhost.gqlgenc
      jq
      nhost.kubectl
      lychee
      mockgen
      nhost.nhost-cli
      nixfmt
      nhost.nodejs
      nhost.vercel
      nhost.oapi-codegen
      pkg-config
      nhost.playwright-driver
      nhost.pnpm
      nhost.postgresql_14-client
      nhost.postgresql_15
      nhost.postgresql_15-client
      nhost.postgresql_16
      nhost.postgresql_16-client
      nhost.postgresql_17
      nhost.postgresql_17-client
      nhost.postgresql_18
      nhost.postgresql_18-client
      python312Packages.certbot-dns-route53
      shellcheck
      skopeo
      nhost.sqlc
      vacuum-go
      vale
      nhost.wal-g
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
  check = pkgs.symlinkJoin {
    name = "check-nixops";
    paths = [
      (nixops-lib.nix.check { inherit src; })
      (nixops-lib.nix.checkPinnedToolchains {
        # Repo-wide: toolchain regressions tend to land in the individual
        # projects' project.nix, not under nixops/.
        src = fs.toSource {
          root = ../.;
          fileset = fs.fileFilter (f: f.hasExt "nix") ../.;
        };
      })
    ];
  };

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
