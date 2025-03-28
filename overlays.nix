(final: prev: {
  nodejs = prev.nodejs_20;

  oapi-codegen = prev.oapi-codegen.override {
    buildGoModule = args: final.buildGoModule (args // rec {
      version = "2.5.0-beta01";
      src = prev.fetchFromGitHub {
        owner = "dbarrosop";
        repo = "oapi-codegen";
        rev = "1ad6f36b618b60c577f9f9eb1018c97b64762514";
        sha256 = "sha256-+qtiKwCpFBo5d8l6cUCHE655oszU1ZYizJ2prCEF8dI=";
      };

      vendorHash = "sha256-xPBf5Jt70A1P3/9MJI/zyYGiiwM/Tpl7V+THa5e4lLQ=";
    });
  };

})

