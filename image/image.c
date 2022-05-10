#include "image.h"

#include <vips/vips.h>

void debug(int n) {
  printf("%d. current mem: %zu\n", n, vips_tracked_get_mem());
  printf("%d. highwater: %zu\n", n, vips_tracked_get_mem_highwater());
  printf("%d. allocs: %d\n", n, vips_tracked_get_allocs());
  printf("%d. files: %d\n", n, vips_tracked_get_files());
  vips_cache_print();
}

int manipulate(void *buf, size_t len, Result *result, Options options) {
  VipsImage *orig = vips_image_new_from_buffer(buf, len, "", "access",
                                               VIPS_ACCESS_SEQUENTIAL, NULL);

  VipsImage *out;
  int width = options.width;
  int height = options.height;
  int err;
  if (width != 0 || height != 0) {
    if (width == 0) {
      width = ((float)height / orig->Ysize) * orig->Xsize;
    }
    if (height == 0) {
      height = ((float)width / orig->Xsize) * orig->Ysize;
    }
    int err = vips_thumbnail_image(orig, &out, width, "height", height, "crop",
                                   options.crop, "size", options.size, NULL);
    if (err != 0) {
      g_object_unref(out);
      return err;
    }
    g_object_unref(orig);
  } else {
    out = orig;
  }

  if (options.blur > 0) {
    VipsImage *blurred;
    vips_gaussblur(out, &blurred, options.blur, NULL);
    g_object_unref(out);
    out = blurred;
  }

  if (options.quality == 0) {
    options.quality = 85;
  }

  switch (options.format) {
  case JPEG:
    err = vips_jpegsave_buffer(out, &result->buf, &result->len, "Q",
                               options.quality, "strip", TRUE, NULL);
    break;
  case PNG:
    err = vips_pngsave_buffer(out, &result->buf, &result->len, "Q",
                              options.quality, NULL);
    break;
  case WEBP:
    err = vips_webpsave_buffer(out, &result->buf, &result->len, "Q",
                               options.quality, NULL);
    break;
  default:
    err = 1;
  }

  g_object_unref(out);

  return err;
}
