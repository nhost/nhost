{ buildPGXSExtension, pkgs, ... }:

buildPGXSExtension rec {
  pname = "pg_repack";
  version = "1.5.3";

  buildInputs = pkgs.postgresql.buildInputs ++ [ pkgs.numactl ];

  src = pkgs.fetchFromGitHub {
    owner = "reorg";
    repo = "pg_repack";
    rev = "ver_${version}";
    sha256 = "sha256-Ufh/dKrKumRKeQ/CpwvxbjAmgILAn04BduPZMRvS+nU=";
  };
}

