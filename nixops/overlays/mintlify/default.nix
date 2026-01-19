{ final }:
final.buildNpmPackage {
  pname = "mintlify";
  version = "4.2.284";

  src = ./package;

  npmDepsHash = "sha256-5lnk5NKXK1WkaNT7iUW4ieQnXl+hFfGUWkuFHrbuTOI=";

  dontNpmBuild = true;

  env = {
    PUPPETEER_SKIP_DOWNLOAD = "true";
  };
}
