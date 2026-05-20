{ final }:
let
  version = "1.46.0";
  dist = {
    aarch64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-arm64.tar.gz";
      sha256 = "13dm6714h3sk2kjm293s070cl0ff7p10psxr8r7aikczilfmp8yd";
    };
    x86_64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-amd64.tar.gz";
      sha256 = "1kfp0f1nvszdhmixwvyqzah0i3jhicdw8sqzyvsp5yfld5izln5s";
    };
    aarch64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-arm64.tar.gz";
      sha256 = "13px0yhl2mzhgr6rdnhxnkc1pkrfnjncnfhpkbwakiqam7s7w3gl";
    };
    x86_64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-amd64.tar.gz";
      sha256 = "1ibcqlns85jsn5b7wr86swvrdwjq0ln15dvilb3waz2kacyv8mmg";
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
