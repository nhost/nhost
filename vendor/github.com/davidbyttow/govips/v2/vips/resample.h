// https://libvips.github.io/libvips/API/current/libvips-resample.html

#include <stdlib.h>
#include <vips/vips.h>

int shrink_image(VipsImage *in, VipsImage **out, double xshrink,
                 double yshrink);
int reduce_image(VipsImage *in, VipsImage **out, double xshrink,
                 double yshrink);
int affine_image(VipsImage *in, VipsImage **out, double a, double b, double c,
                 double d, VipsInterpolate *interpolator);
int resize_image(VipsImage *in, VipsImage **out, double scale, gdouble vscale,
                 int kernel);
int thumbnail(const char *filename, VipsImage **out, int width, int height,
                    int crop, int size);
int thumbnail_image(VipsImage *in, VipsImage **out, int width, int height,
                    int crop, int size);
int thumbnail_buffer(void *buf, size_t len, VipsImage **out, int width, int height,
                    int crop, int size);
int thumbnail_buffer_with_option(void *buf, size_t len, VipsImage **out,
                    int width, int height, int crop, int size,
                    const char *option_string);
int mapim(VipsImage *in, VipsImage **out, VipsImage *index);
int maplut(VipsImage *in, VipsImage **out, VipsImage *lut);
