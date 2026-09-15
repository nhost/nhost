{ buildPGRXExtension, pkgs, ... }:

buildPGRXExtension rec {
  pname = "pg_durable";
  version = "0.2.5";

  cargo-pgrx = pkgs.cargo-pgrx_0_16_1;

  doCheck = false;

  buildFeatures = [ "http-allow-all" ];

  buildInputs = [ pkgs.openssl ];
  nativeBuildInputs = [ pkgs.pkg-config ];

  src = pkgs.fetchFromGitHub {
    owner = "microsoft";
    repo = pname;
    rev = "v${version}";
    hash = "sha256-BayklfKGK6mSHOqkO4OXVZ88WsXsREb3z7YfD2dAKow=";
  };

  cargoHash = "sha256-a1GezR7Dubn8d0pmVA3MCvLPrm+FrSZsNmymwPE+Iag=";
}
