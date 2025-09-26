#include "color.h"
#include <unistd.h>

int is_colorspace_supported(VipsImage *in) {
  return vips_colourspace_issupported(in) ? 1 : 0;
}

int to_colorspace(VipsImage *in, VipsImage **out, VipsInterpretation space) {
  return vips_colourspace(in, out, space, NULL);
}

// https://libvips.github.io/libvips/API/8.6/libvips-colour.html#vips-icc-transform
int icc_transform(VipsImage *in, VipsImage **out, const char *output_profile, const char *input_profile, VipsIntent intent,
	int depth, gboolean embedded) {
	return vips_icc_transform(
    	in, out, output_profile,
    	"input_profile", input_profile ? input_profile : "none",
    	"intent", intent,
    	"depth", depth ? depth : 8,
    	"embedded", embedded,
    	NULL);
}
