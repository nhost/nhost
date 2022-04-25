#include "header.h"

#include <unistd.h>

unsigned long has_icc_profile(VipsImage *in) {
  return vips_image_get_typeof(in, VIPS_META_ICC_NAME);
}

gboolean remove_icc_profile(VipsImage *in) {
  return vips_image_remove(in, VIPS_META_ICC_NAME);
}

unsigned long has_iptc(VipsImage *in) {
  return vips_image_get_typeof(in, VIPS_META_IPTC_NAME);
}

char** image_get_fields(VipsImage *in) {
    return vips_image_get_fields(in);
}

// won't remove the ICC profile, orientation and pages metadata
void remove_metadata(VipsImage *in) {
  gchar **fields = vips_image_get_fields(in);

  for (int i = 0; fields[i] != NULL; i++) {
    if (strncmp(fields[i], VIPS_META_ICC_NAME, sizeof(VIPS_META_ICC_NAME)) &&
        strncmp(fields[i], VIPS_META_ORIENTATION, sizeof(VIPS_META_ORIENTATION)) &&
        strncmp(fields[i], VIPS_META_N_PAGES, sizeof(VIPS_META_N_PAGES)) &&
        strncmp(fields[i], VIPS_META_PAGE_HEIGHT, sizeof(VIPS_META_PAGE_HEIGHT))
        ) {
      vips_image_remove(in, fields[i]);
    }
  }

  g_strfreev(fields);
}

int get_meta_orientation(VipsImage *in) {
  int orientation = 0;
  if (vips_image_get_typeof(in, VIPS_META_ORIENTATION) != 0) {
    vips_image_get_int(in, VIPS_META_ORIENTATION, &orientation);
  }

  return orientation;
}

void remove_meta_orientation(VipsImage *in) {
  vips_image_remove(in, VIPS_META_ORIENTATION);
}

void set_meta_orientation(VipsImage *in, int orientation) {
  vips_image_set_int(in, VIPS_META_ORIENTATION, orientation);
}

// https://libvips.github.io/libvips/API/current/libvips-header.html#vips-image-get-n-pages
int get_image_n_pages(VipsImage *in) {
  int n_pages = 0;
  n_pages = vips_image_get_n_pages(in);
  return n_pages;
}

void set_image_n_pages(VipsImage *in, int n_pages) {
  vips_image_set_int(in, VIPS_META_N_PAGES, n_pages);
}

// https://www.libvips.org/API/current/libvips-header.html#vips-image-get-page-height
int get_page_height(VipsImage *in) {
  int page_height = 0;
  page_height = vips_image_get_page_height(in);
  return page_height;
}

void set_page_height(VipsImage *in, int height) {
  vips_image_set_int(in, VIPS_META_PAGE_HEIGHT, height);
}

int get_meta_loader(const VipsImage *in, const char **out) {
  return vips_image_get_string(in, VIPS_META_LOADER, out);
}

int get_image_delay(VipsImage *in, int **out) {
  return vips_image_get_array_int(in, "delay", out, NULL);
}

void set_image_delay(VipsImage *in, const int *array, int n) {
  return vips_image_set_array_int(in, "delay", array, n);
}
