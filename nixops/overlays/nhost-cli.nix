{ final }:
let
  version = "v1.31.0";
  dist = {
    aarch64-darwin = {
      url = "https://github.com/nhost/cli/releases/download/${version}/cli-${version}-darwin-arm64.tar.gz";
      sha256 = "1jynlr7gla4snpcszpkh2vkq47774x5w8js6ghw4s4aa6jp5wcw4";
    };
    x86_64-darwin = {
      url = "https://github.com/nhost/cli/releases/download/${version}/cli-${version}-darwin-amd64.tar.gz";
      sha256 = "1z8w7830yaf3zwy3ajilav1zg9y8x583gjna6z41v32hj04yk55h";
    };
    aarch64-linux = {
      url = "https://github.com/nhost/cli/releases/download/${version}/cli-${version}-linux-arm64.tar.gz";
      sha256 = "10z032jxi0vi08p4i12lgb01jr16x0mrki8hhzl2hpbhq97wzmdj";
    };
    x86_64-linux = {
      url = "https://github.com/nhost/cli/releases/download/${version}/cli-${version}-linux-amd64.tar.gz";
      sha256 = "0la5czcqc8wbdvqa8rbqaibf5c07zls9a98ihb950jyx8vwsi2ly";
    };
  };

in
final.stdenvNoCC.mkDerivation {
  pname = "nhost-cli";
  inherit version;

  src = final.fetchurl {
    inherit (dist.${final.stdenvNoCC.hostPlatform.system} or
      (throw "Unsupported system: ${final.stdenvNoCC.hostPlatform.system}")) url sha256;
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
