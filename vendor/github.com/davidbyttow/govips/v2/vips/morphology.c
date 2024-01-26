#include "morphology.h"

int rank(VipsImage *in, VipsImage **out, int width, int height, int index) {
  return vips_rank(in, out, width, height, index, NULL);
}

