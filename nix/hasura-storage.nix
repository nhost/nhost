{ stdenv
, go
, lib

, GOOS ? ""
  # # dependencies to build software
  # , nativeBuildInputs

, name
, version

  # Go linker flags, passed to go via -ldflags
, ldflags

  # Go tags, passed to go via -tag
, tags
, buildInputs
, nativeBuildInputs
}:

let
  package = stdenv.mkDerivation
    {
      pname = name;
      version = version;

      src = ../.;

      patches = [ ];
      preBuild = "";
      sourceRoot = "";

      GOOS = GOOS;

      buildInputs = buildInputs;
      nativeBuildInputs = nativeBuildInputs;

      configurePhase = ''
        runHook preConfigure

        export GOCACHE=$TMPDIR/.cache/go-build
        export GOMODCACHE="$TMPDIR/.cache/mod"

        runHook postConfigure
      '';

      buildPhase = ''
        runHook preBuild

        go build \
            -mod=vendor \
            -tags=${tags} \
            -ldflags="${ldflags}" \
            -o hasura-storage-bin \
            -trimpath \
            main.go

        runHook postBuild
      '';

      checkPhase = ''
        runHook preCheck
        runHook postCheck
      '';

      installPhase = ''
        runHook preInstall
        runHook postInstall
      '';

      postInstall = ''
        mkdir -p $out/bin
        mv hasura-storage-bin $out/bin/hasura-storage

        # $out/bin/hasura-storage --version 
      '';

      strictDeps = true;
      disallowedReferences = go;

      meta = {
        description = "Hasura Storage is awesome";
        homepage = "https://github.com/nhost/hasura-storage";
        license = lib.licenses.mit;
        maintainers = [ "nhost" ];
        platforms = lib.platforms.linux ++ lib.platforms.darwin;
      };
    };
in
package
