// https://libvips.github.io/libvips/API/current/libvips-create.html

// clang-format off
// include order matters
#include <stdlib.h>
#include <vips/vips.h>
#include <vips/foreign.h>
// clang-format on

int xyz(VipsImage **out, int width, int height);
int black(VipsImage **out, int width, int height);
int identity(VipsImage **out, int ushort);
