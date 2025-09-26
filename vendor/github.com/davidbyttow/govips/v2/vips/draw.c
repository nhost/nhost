#include "draw.h"

#include "conversion.h"

int draw_rect(VipsImage *in, double r, double g, double b, double a, int left,
              int top, int width, int height, int fill) {
  if (is_16bit(in->Type)) {
    r = 65535 * r / 255;
    g = 65535 * g / 255;
    b = 65535 * b / 255;
    a = 65535 * a / 255;
  }

  double background[3] = {r, g, b};
  double backgroundRGBA[4] = {r, g, b, a};

  if (in->Bands <= 3) {
    return vips_draw_rect(in, background, 3, left, top, width, height, "fill",
                          fill, NULL);
  } else {
    return vips_draw_rect(in, backgroundRGBA, 4, left, top, width, height,
                          "fill", fill, NULL);
  }
}
