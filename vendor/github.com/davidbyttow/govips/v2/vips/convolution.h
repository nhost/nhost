// https://libvips.github.io/libvips/API/current/libvips-convolution.html

#include <stdlib.h>
#include <vips/vips.h>

int gaussian_blur_image(VipsImage *in, VipsImage **out, double sigma, double min_ampl);
int sharpen_image(VipsImage *in, VipsImage **out, double sigma, double x1,
                  double m2);
int sobel_image(VipsImage *in, VipsImage **out);
