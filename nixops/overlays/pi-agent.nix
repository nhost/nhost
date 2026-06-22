{ final }:
let
  packageJson = builtins.fromJSON (builtins.readFile ./pi-agent/package.json);
  version = packageJson.dependencies."@earendil-works/pi-coding-agent";
  cliPath = "node_modules/@earendil-works/pi-coding-agent/dist/cli.js";

  # Hermetic `bun install` of the pinned agent + its transitive deps.
  # Uses `__noChroot` (network during build) the same way services/auth does;
  # enabled by `nixConfig.sandbox = "relaxed"` in flake.nix.
  node_modules = final.stdenv.mkDerivation {
    pname = "pi-agent-node-modules";
    inherit version;

    __noChroot = true;

    src = ./pi-agent;

    nativeBuildInputs = with final; [
      bun
      cacert
    ];

    buildPhase = ''
      export HOME=$TMPDIR
      bun install --frozen-lockfile --ignore-scripts
    '';

    installPhase = ''
      mkdir -p $out
      cp -r node_modules $out/
    '';
  };
in
final.stdenvNoCC.mkDerivation {
  pname = "pi-agent";
  inherit version;

  dontUnpack = true;

  nativeBuildInputs = [ final.makeWrapper ];

  installPhase = ''
    mkdir -p $out/libexec/pi
    cp -r ${node_modules}/node_modules $out/libexec/pi/node_modules

    # Force the bun runtime, and keep the node_modules tree intact next to
    # cli.js so bun resolves the sibling @earendil-works/* deps from
    # $out/libexec/pi/node_modules. fd/ripgrep are made available on PATH and
    # telemetry/version-check are disabled (matching numtide/llm-agents.nix).
    makeWrapper ${final.bun}/bin/bun $out/bin/pi-agent \
      --add-flags "$out/libexec/pi/${cliPath}" \
      --prefix PATH : ${
        final.lib.makeBinPath (
          with final;
          [
            fd
            ripgrep
          ]
        )
      } \
      --set PI_SKIP_VERSION_CHECK 1 \
      --set PI_TELEMETRY 0
  '';

  meta = with final.lib; {
    description = "pi - terminal coding agent (@earendil-works/pi-coding-agent), run via bun";
    homepage = "https://github.com/earendil-works/pi";
    license = licenses.mit;
    mainProgram = "pi";
  };
}
