{ final }:
let
  version = "1.42.1";
  dist = {
    aarch64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-arm64.tar.gz";
      sha256 = "1w76j9y2hlpam9sk1sbd7fy1anb4aqzvlypn5j03kwra7r2x3zpp";
    };
    x86_64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-amd64.tar.gz";
      sha256 = "1n34nz1h1n5f935bl533svfng5bh7xk8v9h46pwicvjic3gx4mzf";
    };
    aarch64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-arm64.tar.gz";
      sha256 = "0p8wvrgbfpw0brb91m8kxswjp4ja6lgq12a46y5dlg2v09qnil7m";
    };
    x86_64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-amd64.tar.gz";
      sha256 = "0c9y91p33salym2ng3cjbll115x90lvip0mwc63f397866pj54p8";
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
