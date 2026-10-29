{
  self,
  pkgs,
  nixops-lib,
}:
let
  name = "vale";

  fs = pkgs.lib.fileset;
  root = ../..;

  # The rule fixtures and every Markdown file .vale/lint_markdown.sh may
  # select. The docs site and the blog are left out: their own checks lint
  # them, so a page edit there does not rebuild this check.
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

  devShell = pkgs.mkShell {
    packages = checkInputs;
  };
}
