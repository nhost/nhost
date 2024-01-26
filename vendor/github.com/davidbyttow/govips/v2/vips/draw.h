// https://libvips.github.io/libvips/API/current/libvips-draw.html

#include <stdlib.h>
#include <vips/vips.h>

int draw_rect(VipsImage *in, double r, double g, double b, double a, int left,
              int top, int width, int height, int fill);
