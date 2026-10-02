{ final }:
let
  version = "1.51.2";
  dist = {
    aarch64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-arm64.tar.gz";
      sha256 = "04fr3ggl4yzhqhg6ncvd9s0gqk67sr1npc05g8alimahw7pk9bqs";
    };
    x86_64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-amd64.tar.gz";
      sha256 = "1ndryxr6nr3pgcb2cmlf4n95qblzx7fnp5m8l61fdi6zla2z183n";
    };
    aarch64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-arm64.tar.gz";
      sha256 = "1ii4fnc6gcn1hvkmiwsxs82xnki0cgyw6wsrdg0c6ldfz9lnph1q";
    };
    x86_64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-amd64.tar.gz";
      sha256 = "14p24j95mg93qp7pj8gwn4hnpqg2pp4pvmhkavpb02g0hxa645f5";
    };
  };

in
final.stdenvNoCC.mkDerivation {
  pname = "nhost-cli";
  inherit version;

  src = final.fetchurl {
    inherit
      (dist.${final.stdenvNoCC.hostPlatform.system}
        or (throw "Unsupported system: ${final.stdenvNoCC.hostPlatform.system}")
      )
      url
      sha256
      ;
  };

  sourceRoot = ".";

  nativeBuildInputs = [
    final.unzip
    final.makeWrapper
    final.installShellFiles
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    mv cli $out/bin/nhost

    # installShellCompletion --cmd nhost \
    #   --bash <($out/bin/nhost completion bash) \
    #   --fish <($out/bin/nhost completion fish) \
    #   --zsh <($out/bin/nhost completion zsh)

    runHook postInstall
  '';

  meta = with final.lib; {
    description = "Nhost CLI";
    homepage = "https://nhost.io";
    license = licenses.mit;
    maintainers = [ "@nhost" ];
  };

}
