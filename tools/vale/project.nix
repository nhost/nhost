{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "vale";

  fs = pkgs.lib.fileset;
  root = ../..;

  # Fixtures and repository Markdown; docs and blog pages have their own checks.
  src = fs.toSource {
    inherit root;
    fileset = fs.unions [
      ../../.vale.ini
      ../../.vale
      (fs.difference (fs.fileFilter (file: file.hasExt "md" || file.hasExt "mdx") root) (
        fs.unions [
          ../../docs/src/content/docs
          ../../landing/src/pages/blog
          ../../vendor
        ]
      ))
    ];
  };

  checkInputs = with pkgs; [
    bash
    findutils
    gnused
    vale
  ];
in
{
  check =
    pkgs.runCommand "check-${name}"
      {
        nativeBuildInputs = checkInputs;
      }
      ''
        export HOME=$TMPDIR
        cp -r ${src} source
        chmod -R u+w source
        cd source

        bash .vale/test.sh
        bash .vale/lint_markdown.sh --minAlertLevel=error

        mkdir "$out"
      '';

  # typos isn't gated until main has no misspellings.
  devShell = pkgs.mkShell {
    packages = checkInputs ++ [ pkgs.typos ];
  };
}
