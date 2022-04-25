#include "arithmetic.h"

int add(VipsImage *left, VipsImage *right, VipsImage **out) {
  return vips_add(left, right, out, NULL);
}

int multiply(VipsImage *left, VipsImage *right, VipsImage **out) {
  return vips_multiply(left, right, out, NULL);
}

int divide(VipsImage *left, VipsImage *right, VipsImage **out) {
  return vips_divide(left, right, out, NULL);
}

int linear(VipsImage *in, VipsImage **out, double *a, double *b, int n) {
  return vips_linear(in, out, a, b, n, NULL);
}

int linear1(VipsImage *in, VipsImage **out, double a, double b) {
  return vips_linear1(in, out, a, b, NULL);
}

int invert_image(VipsImage *in, VipsImage **out) {
  return vips_invert(in, out, NULL);
}

int average(VipsImage *in, double *out) {
	return vips_avg(in, out, NULL);
}

int find_trim(VipsImage *in, int *left, int *top, int *width, int *height,
              double threshold, double r, double g, double b) {

  if (in->Type == VIPS_INTERPRETATION_RGB16 || in->Type == VIPS_INTERPRETATION_GREY16) {
    r = 65535 * r / 255;
    g = 65535 * g / 255;
    b = 65535 * b / 255;
  }

  double background[3] = {r, g, b};
  VipsArrayDouble *vipsBackground = vips_array_double_new(background, 3);

  int code = vips_find_trim(in, left, top, width, height, "threshold", threshold, "background", vipsBackground, NULL);

  vips_area_unref(VIPS_AREA(vipsBackground));
  return code;
}

int getpoint(VipsImage *in, double **vector, int n, int x, int y) {
  return vips_getpoint(in, vector, &n, x, y, NULL);
}
