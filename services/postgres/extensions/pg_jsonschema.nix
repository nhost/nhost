{ buildPGRXExtension, pkgs, ... }:

buildPGRXExtension rec {
  pname = "pg_jsonschema";
  version = "v0.4.0-rc1";

  doCheck = false;

  cargo-pgrx = pkgs.cargo-pgrx_0_16_1;

  src = pkgs.fetchFromGitHub {
    owner = "supabase";
    repo = pname;
    rev = "7c8603f14d8d20ea84435b0b8409a4e1a40147b0";
    hash = "sha256-zTYEFkz0cpLFG+6k3ZUWwJ//184QfwTF9keh3WebPPw=";
  };

  cargoHash = "sha256-LutCrn4HRFyh+NkPNH2Zi9ko+Ickv0geaAQXYw0AzTw=";
}
