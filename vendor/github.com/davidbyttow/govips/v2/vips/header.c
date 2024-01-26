#include "header.h"

#include <unistd.h>

unsigned long has_icc_profile(VipsImage *in) {
  return vips_image_get_typeof(in, VIPS_META_ICC_NAME);
}

unsigned long get_icc_profile(VipsImage *in, const void **data,
                              size_t *dataLength) {
  return image_get_blob(in, VIPS_META_ICC_NAME, data, dataLength);
}

gboolean remove_icc_profile(VipsImage *in) {
  return vips_image_remove(in, VIPS_META_ICC_NAME);
}

unsigned long has_iptc(VipsImage *in) {
  return vips_image_get_typeof(in, VIPS_META_IPTC_NAME);
}

char **image_get_fields(VipsImage *in) { return vips_image_get_fields(in); }

void image_set_string(VipsImage *in, const char *name, const char *str) {
  vips_image_set_string(in, name, str);
}

unsigned long image_get_string(VipsImage *in, const char *name,
                               const char **out) {
  return vips_image_get_string(in, name, out);
}

unsigned long image_get_as_string(VipsImage *in, const char *name, char **out) {
  return vips_image_get_as_string(in, name, out);
}

void remove_field(VipsImage *in, char *field) { vips_image_remove(in, field); }

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

void image_set_double(VipsImage *in, const char *name, double i) {
  vips_image_set_double(in, name, i);
}

unsigned long image_get_double(VipsImage *in, const char *name, double *out) {
  return vips_image_get_double(in, name, out);
}

void image_set_int(VipsImage *in, const char *name, int i) {
  vips_image_set_int(in, name, i);
}

unsigned long image_get_int(VipsImage *in, const char *name, int *out) {
  return vips_image_get_int(in, name, out);
}

void image_set_blob(VipsImage *in, const char *name, const void *data,
                    size_t dataLength) {
  vips_image_set_blob_copy(in, name, data, dataLength);
}

unsigned long image_get_blob(VipsImage *in, const char *name, const void **data,
                             size_t *dataLength) {
  if (vips_image_get_typeof(in, name) == 0) {
    return 0;
  }

  if (vips_image_get_blob(in, name, data, dataLength)) {
    return -1;
  }

  return 0;
}