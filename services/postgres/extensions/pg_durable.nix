{ buildPGRXExtension, pkgs, ... }:

buildPGRXExtension rec {
  pname = "pg_durable";
  version = "0.2.9";

  cargo-pgrx = pkgs.cargo-pgrx_0_16_1;

  doCheck = false;

  buildInputs = [ pkgs.openssl ];
  nativeBuildInputs = [ pkgs.pkg-config ];

  src = pkgs.fetchFromGitHub {
    owner = "microsoft";
    repo = pname;
    rev = "v${version}";
    hash = "sha256-e2RDGBxOH5GdCRLz2DVDDRij/+/yFbLCwkxQfCG+/vY=";
  };

  cargoHash = "sha256-/5VIyFfICZNkT+oeDzZI+qVXDsBhmyhLQqFF07Xwvys=";
}
