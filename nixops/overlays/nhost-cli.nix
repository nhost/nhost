{ final }:
let
  version = "1.50.2";
  dist = {
    aarch64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-arm64.tar.gz";
      sha256 = "0pm17ypxnph2l2bx09k9mzqfyy15akj5rj4j2zsjnln7iv2r7alf";
    };
    x86_64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-amd64.tar.gz";
      sha256 = "0875r1azj1jlj4d1slsxwc852zh6bg3g21iif90gw57qvyvz232f";
    };
    aarch64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-arm64.tar.gz";
      sha256 = "0dgp7qq2qg38j91wxsvpl65dnjdxypzf6b0qnlfrs4r1c0crynxy";
    };
    x86_64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-amd64.tar.gz";
      sha256 = "0a3xarmzpimdhka5mqc5l9f397d4v9y8h1ymnxwmqy3dzbk1cchk";
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
