#!/usr/bin/env python3

import struct
import zlib

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

# Create all required icons
icons = [
    ('32x32.png', 32),
    ('128x128.png', 128),
    ('128x128@2x.png', 256),
    ('icon.png', 512),
]

for filename, size in icons:
    path = f'src-tauri/icons/{filename}'
    with open(path, 'wb') as f:
        f.write(create_rgba_png(size, size))
    print(f'Created {path} ({size}x{size} RGBA)')

# Create ICO file (Windows)
with open('src-tauri/icons/icon.ico', 'wb') as f:
    # Simple ICO header pointing to 32x32 PNG data
    f.write(b'\x00\x00\x01\x00\x01\x00\x20\x20\x00\x00\x01\x00\x20\x00')
    png_data = create_rgba_png(32, 32)
    f.write(struct.pack('<I', len(png_data)))
    f.write(struct.pack('<I', 22))  # offset
    f.write(png_data)
print('Created src-tauri/icons/icon.ico')

# Create ICNS file (macOS) - simplified placeholder
with open('src-tauri/icons/icon.icns', 'wb') as f:
    f.write(b'icns')  # Magic number
    f.write(struct.pack('>I', 8))  # File size placeholder
print('Created src-tauri/icons/icon.icns (placeholder)')

print('\nAll icons created successfully!')