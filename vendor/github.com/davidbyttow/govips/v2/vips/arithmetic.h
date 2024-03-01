// https://libvips.github.io/libvips/API/current/libvips-arithmetic.html

#include <stdlib.h>
#include <vips/vips.h>

int add(VipsImage *left, VipsImage *right, VipsImage **out);
int multiply(VipsImage *left, VipsImage *right, VipsImage **out);
int divide(VipsImage *left, VipsImage *right, VipsImage **out);
int linear(VipsImage *in, VipsImage **out, double *a, double *b, int n);
int linear1(VipsImage *in, VipsImage **out, double a, double b);
int invert_image(VipsImage *in, VipsImage **out);
int average(VipsImage *in, double *out);
int find_trim(VipsImage *in, int *left, int *top, int *width, int *height,
              double threshold, double r, double g, double b);
int getpoint(VipsImage *in, double **vector, int n, int x, int y);
int stats(VipsImage *in, VipsImage **out);
int hist_find(VipsImage *in, VipsImage **out);
int hist_cum(VipsImage *in, VipsImage **out);
int hist_norm(VipsImage *in, VipsImage **out);
int hist_entropy(VipsImage *in, double *out);
