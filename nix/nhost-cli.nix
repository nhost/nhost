{ final, prev }:
let
  version = "v1.8.0";
  dist = {
    aarch64-darwin = rec {
      url = "https://github.com/nhost/cli/releases/download/${version}/cli-${version}-darwin-arm64.tar.gz";
      sha256 = "0hxzspili4h8d0pmhkpn3g89ms5x8zmdnq8mg3g5fp0fla0a4z0p";
    };
    x86_64-linux = rec {
      url = "https://github.com/nhost/cli/releases/download/${version}/cli-${version}-linux-amd64.tar.gz";
      sha256 = "1hz8x5pv6c1bqsfvv6wz64dwnrfdwvjnlk47linxa1kb81k1ifq1";
    };
    aarch64-linux = rec {
      url = "https://github.com/nhost/cli/releases/download/${version}/cli-${version}-linux-arm64.tar.gz";
      sha256 = "1vcv8ajd96f9d4n7x6g4myds9qfw2cfbigg8x2w4gvys9q9zhzf7";
    };
  };

in
final.stdenvNoCC.mkDerivation rec {
  pname = "nhost-cli";
  inherit version;

  src = final.fetchurl {
    inherit (dist.${final.stdenvNoCC.hostPlatform.system} or
      (throw "Unsupported system: ${final.stdenvNoCC.hostPlatform.system}")) url sha256;
  };


  sourceRoot = ".";

  nativeBuildInputs = [
    final.makeWrapper
    final.installShellFiles
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    mv cli $out/bin/nhost

    installShellCompletion --cmd nhost \
      --bash <($out/bin/nhost completion bash) \
      --fish <($out/bin/nhost completion fish) \
      --zsh <($out/bin/nhost completion zsh)

    runHook postInstall
  '';

  meta = with final.lib; {
    description = "Nhost CLI";
    homepage = "https://nhost.io";
    license = licenses.mit;
    maintainers = [ "@nhost" ];
  };

}
