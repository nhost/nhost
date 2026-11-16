{ buildPGRXExtension, pkgs, ... }:

buildPGRXExtension rec {
  pname = "pg_durable";
  version = "0.2.8";

  cargo-pgrx = pkgs.cargo-pgrx_0_16_1;

  doCheck = false;

  buildFeatures = [ "http-allow-all" ];

  buildInputs = [ pkgs.openssl ];
  nativeBuildInputs = [ pkgs.pkg-config ];

  src = pkgs.fetchFromGitHub {
    owner = "microsoft";
    repo = pname;
    rev = "v${version}";
    hash = "sha256-khNR44xZbVVXd50BW3s3+xQlD2XyHW3suZJgQJWed3s=";
  };

  cargoHash = "sha256-rYNJai3Z7Ra9Y5GFRxvvz/IlDla00vRHfYmNqXeDOXk=";
}
