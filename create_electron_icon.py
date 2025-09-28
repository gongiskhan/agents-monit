#!/usr/bin/env python3

import struct
import zlib
import os

def create_rgba_png(width, height):
    """Create a proper RGBA PNG with transparency"""
    # PNG header
    header = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk (width, height, bit depth=8, color type=6 for RGBA, compression, filter, interlace)
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr = b'IHDR' + ihdr_data
    ihdr_crc = zlib.crc32(ihdr)
    ihdr_chunk = struct.pack('>I', 13) + ihdr + struct.pack('>I', ihdr_crc)

    # IDAT chunk (RGBA pixels - purple with full opacity)
    scanlines = []
    for _ in range(height):
        scanline = b'\x00'  # filter type 0 (None)
        for _ in range(width):
            # RGBA: R=102, G=126, B=234, A=255 (full opacity)
            scanline += b'\x66\x7e\xea\xff'
        scanlines.append(scanline)

    raw_data = b''.join(scanlines)
    compressed = zlib.compress(raw_data, 9)
    idat = b'IDAT' + compressed
    idat_crc = zlib.crc32(idat)
    idat_chunk = struct.pack('>I', len(compressed)) + idat + struct.pack('>I', idat_crc)

    # IEND chunk
    iend = b'IEND'
    iend_crc = zlib.crc32(iend)
    iend_chunk = struct.pack('>I', 0) + iend + struct.pack('>I', iend_crc)

    return header + ihdr_chunk + idat_chunk + iend_chunk

# Create public directory if it doesn't exist
os.makedirs('public', exist_ok=True)

# Create icon for Electron
path = 'public/icon.png'
with open(path, 'wb') as f:
    f.write(create_rgba_png(512, 512))
print(f'Created {path} (512x512 RGBA)')

print('\nIcon created successfully!')