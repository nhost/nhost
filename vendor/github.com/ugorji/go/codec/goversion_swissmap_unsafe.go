// Copyright (c) 2012-2020 Ugorji Nwoke. All rights reserved.
// Use of this source code is governed by a MIT license found in the LICENSE file.

//go:build !safe && !codec.safe && !appengine && go1.24

package codec

import "unsafe"

// retrofited from linknameIter struct (compatibility layer for swissmaps)

type unsafeMapIterPadding struct {
	_ [2]unsafe.Pointer // padding: *abi.SwissMapType, *maps.Iter
	_ uintptr           // padding: wasted (try to fill cache-line at multiple of 4)
}
