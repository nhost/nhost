#include "image.h"

int has_alpha_channel(VipsImage *image) { return vips_image_hasalpha(image); }

void clear_image(VipsImage **image) {
  // https://developer.gnome.org/gobject/stable/gobject-The-Base-Object-Type.html#g-clear-object
  if (G_IS_OBJECT(*image)) g_clear_object(image);
}
