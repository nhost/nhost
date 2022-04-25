// https://libvips.github.io/libvips/API/current/libvips-header.html

#include <stdlib.h>
#include <vips/vips.h>

unsigned long has_icc_profile(VipsImage *in);
int remove_icc_profile(VipsImage *in);

unsigned long has_iptc(VipsImage *in);
char** image_get_fields(VipsImage *in);

// won't remove the ICC profile
void remove_metadata(VipsImage *in);

int get_meta_orientation(VipsImage *in);
void remove_meta_orientation(VipsImage *in);
void set_meta_orientation(VipsImage *in, int orientation);
int get_image_n_pages(VipsImage *in);
void set_image_n_pages(VipsImage *in, int n_pages);
int get_page_height(VipsImage *in);
void set_page_height(VipsImage *in, int height);
int get_meta_loader(const VipsImage *in, const char **out);
int get_image_delay(VipsImage *in, int **out);
void set_image_delay(VipsImage *in, const int *array, int n);
