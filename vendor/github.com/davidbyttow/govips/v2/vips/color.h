// https://libvips.github.io/libvips/API/current/libvips-colour.html

#include <stdlib.h>
#include <vips/vips.h>

int is_colorspace_supported(VipsImage *in);
int to_colorspace(VipsImage *in, VipsImage **out, VipsInterpretation space);

int icc_transform(VipsImage *in, VipsImage **out, const char *output_profile, const char *input_profile, VipsIntent intent,
	int depth, gboolean embedded);
