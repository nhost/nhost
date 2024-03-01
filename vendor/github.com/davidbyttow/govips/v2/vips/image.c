#include "image.h"

int has_alpha_channel(VipsImage *image) { return vips_image_hasalpha(image); }

void clear_image(VipsImage **image) {
  // Reference-counting in libvips: https://www.libvips.org/API/current/using-from-c.html#using-C-ref
  // https://docs.gtk.org/gobject/method.Object.unref.html
  if (G_IS_OBJECT(*image)) g_object_unref(*image);
}
