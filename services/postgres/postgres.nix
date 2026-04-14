{ name
, version
, pkgs
, nix2containerPkgs
, basePostgres
}:
let

  locales = pkgs.glibcLocales.override {
    allLocales = false;
    locales = [
      "en_US.UTF-8/UTF-8"
      "C.UTF-8/UTF-8"
    ];
  };

  base-pg = pkgs.stdenvNoCC.mkDerivation {
    name = "base";
    src = ./postgres;
    phases = [ "installPhase" ];
    installPhase = ''
      mkdir -p $out
      cp -r $src/* $out
    '';
  };

  folders = pkgs.runCommand "folders" { } ''
    mkdir -p $out/run/postgresql
    mkdir -p $out/tmp/postgresql
    mkdir -p $out/var/lib/postgresql/data/pgdata
  '';

  postgres = (basePostgres.override {
    systemdSupport = false;
  }).overrideAttrs (oldAttrs: {
    doCheck = false;
    doInstallCheck = false;
  });

  # from https://github.com/NixOS/nixpkgs/blob/nixos-unstable/pkgs/servers/sql/postgresql/generic.nix
  # it'd be better to call `withPackages` with the list of plugins, but for some reason the postgres
  # overlay isn't picked up in that case
  postgres_with_plugins = pkgs.buildEnv {
    name = "postgresql-and-plugins-${postgres.version}";
    paths = pkgs.callPackage ./extensions/default.nix { inherit pkgs postgres; }
      ++ [
      postgres
      postgres.lib
      # postgres.pg_config
    ];
    nativeBuildInputs = [ pkgs.makeWrapper ];


    # We include /bin to ensure the $out/bin directory is created, which is
    # needed because we'll be removing the files from that directory in postBuild
    # below. See #22653
    pathsToLink = [ "/" "/bin" ];

    # Note: the duplication of executables is about 4MB size.
    # So a nicer solution was patching postgresql to allow setting the
    # libdir explicitly.
    postBuild = ''
      mkdir -p $out/bin
      rm $out/bin/{postgres,pg_ctl}
      cp --target-directory=$out/bin ${postgres}/bin/{postgres,pg_ctl}
      wrapProgram $out/bin/postgres --set NIX_PGLIBDIR $out/lib
    '';

    passthru.version = postgres.version;
    passthru.psqlSchema = postgres.psqlSchema;
  };

in
{
  package = postgres_with_plugins;

  dockerImage = nix2containerPkgs.nix2container.buildImage {
    inherit name;
    tag = "${version}";

    copyToRoot = pkgs.buildEnv {
      name = "image";
      paths = [
        pkgs.envsubst
        base-pg
        folders
        postgres_with_plugins
        pkgs.wal-g
        pkgs.cacert
      ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
        pkgs.busybox
      ];
      pathsToLink = [
        "/bin"
        "/etc"
        "/initdb.d"
        "/lib"
        "/nhost.d"
        "/run"
        "/share"
        "/tmp"
        "/var"
      ];

      # Workaround for containerd v2.2.0 bug: https://github.com/containerd/containerd/issues/12683
      # Convert absolute symlinks in /etc/passwd and /etc/group to relative symlinks
      postBuild = ''
        for file in $out/etc/passwd $out/etc/group; do
          if [ -L "$file" ]; then
            target=$(readlink "$file")
            if [ "''${target:0:1}" = "/" ]; then
              # Convert absolute symlink to relative
              rm "$file"
              ln -s "..$target" "$file"
            fi
          fi
        done
      '';
    };

    maxLayers = 100;

    perms = [
      {
        path = folders;
        regex = ".*";
        mode = "0750";
        uid = 999;
        gid = 999;
      }
    ];

    config = {
      User = "postgres";
      Entrypoint = [ "/bin/init.sh" ];
      WorkingDir = "/var/lib/postgresql";
      Env = [
        "ARCHIVE_MODE=off"
        "ARCHIVE_TIMEOUT=300"
        "ARCHIVE_COMMAND=wal-g wal-push %p"
        "RESTORE_COMMAND=wal-g wal-fetch %f %p"
        "LOCALE_ARCHIVE=${locales}/lib/locale/locale-archive"
        "LANGUAGE=en_US.UTF-8"
        "LANG=en_US.UTF-8"
        "LC_ALL=en_US.UTF-8"
        "PGDATA=/var/lib/postgresql/data/pgdata"
        "POSTGRES_DB=local"
        "POSTGRES_USER=postgres"
        "POSTGRES_PASSWORD=postgres"
        "PGHOST=/run/postgresql"
        "PG_MAJOR=16"
        "JIT=on"
        "MAX_CONNECTIONS=100"
        "SHARED_BUFFERS=128MB"
        "EFFECTIVE_CACHE_SIZE=4GB"
        "MAINTENANCE_WORK_MEM=64MB"
        "CHECKPOINT_TIMEOUT=5min"
        "CHECKPOINT_COMPLETION_TARGET=0.9"
        "WAL_BUFFERS=-1"
        "DEFAULT_STATISTICS_TARGET=100"
        "RANDOM_PAGE_COST=4.0"
        "EFFECTIVE_IO_CONCURRENCY=1"
        "WORK_MEM=4MB"
        "HUGE_PAGES=try"
        "MIN_WAL_SIZE=80MB"
        "MAX_WAL_SIZE=1GB"
        "MAX_WORKER_PROCESSES=8"
        "MAX_PARALLEL_WORKERS_PER_GATHER=2"
        "MAX_PARALLEL_WORKERS=8"
        "MAX_PARALLEL_MAINTENANCE_WORKERS=2"
        "WAL_LEVEL=replica"
        "MAX_WAL_SENDERS=10"
        "MAX_REPLICATION_SLOTS=10"
        "SYNCHRONOUS_COMMIT=on"
        "HOT_STANDBY=on"
        "PITR_TARGET_ACTION=shutdown"
        "PITR_TARGET_TIMELINE=latest"
        "TRACK_IO_TIMING=off"
      ];
      ExposedPorts = { "5432/tcp" = { }; };
      Volumes = { "/var/lib/postgresql" = { }; };
    };
  };
}
