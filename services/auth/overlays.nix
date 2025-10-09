(final: prev: {
  nodejs = prev.nodejs_20;

  python312 = prev.python312.override {
    packageOverrides = pyFinal: pyPrev: {
      mocket = pyPrev.mocket.overridePythonAttrs (
        old: rec {
          pname = "mocket";
          version = "3.13.2";

          src = final.fetchPypi {
            inherit pname version;
            hash = "sha256-Gms2WOZowrwf6EQt94QLW3cxhUT1wVeplSd2sX6/8qI=";
          };
        }
      );

    };

    self = final.python312;
  };

})
