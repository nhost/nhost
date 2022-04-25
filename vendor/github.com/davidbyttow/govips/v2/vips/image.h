// https://libvips.github.io/libvips/API/current/VipsImage.html

#include <stdlib.h>
#include <vips/vips.h>

int has_alpha_channel(VipsImage *image);

void clear_image(VipsImage **image);
