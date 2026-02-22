{ final }:
let
  version = "1.38.0";
  dist = {
    aarch64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-arm64.tar.gz";
      sha256 = "1ih8qfxahp68x7cq6h5l3jyj3v0s2xwfh2vyxv0mr4lgg1rjjbyk";
    };
    x86_64-darwin = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-darwin-amd64.tar.gz";
      sha256 = "0v7p5bzdi8iiqjn5w5ai1i1a3n6ax3d06j2v4p4q14g1wz1vgnb6";
    };
    aarch64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-arm64.tar.gz";
      sha256 = "1gca899203sr0118ha8982iang428g15i8s12z800cc10gsz10c9";
    };
    x86_64-linux = {
      url = "https://github.com/nhost/nhost/releases/download/cli%40${version}/cli-${version}-linux-amd64.tar.gz";
      sha256 = "0w3f0b4025qnfagxl50nka47rlky44pz93s19lkffwcr7s4skv8m";
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
