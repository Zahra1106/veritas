const exifr = require('exifr');
const fs = require('fs');

/**
 * Extracts real metadata from an image file (EXIF/GPS/software tags) without
 * ever modifying the original file. Returns null fields gracefully when
 * metadata is absent or the file type doesn't support EXIF (e.g. video/audio).
 */
async function extractMetadata(filePath, mimeType) {
  const stat = fs.statSync(filePath);
  const base = {
    fileSizeBytes: stat.size,
    createdOnDisk: stat.birthtime,
  };

  if (!mimeType.startsWith('image/')) {
    return { ...base, exifAvailable: false, note: 'Metadata extraction is currently supported for images only.' };
  }

  try {
    const data = await exifr.parse(filePath, {
      tiff: true, exif: true, gps: true, xmp: false, icc: false
    });

    if (!data) {
      return { ...base, exifAvailable: false, note: 'No EXIF block found — likely stripped on export or by the source app.' };
    }

    return {
      ...base,
      exifAvailable: true,
      make: data.Make || null,
      model: data.Model || null,
      software: data.Software || null,
      dateTimeOriginal: data.DateTimeOriginal || null,
      gps: data.latitude && data.longitude ? { lat: data.latitude, lng: data.longitude } : null,
      imageWidth: data.ImageWidth || data.ExifImageWidth || null,
      imageHeight: data.ImageHeight || data.ExifImageHeight || null
    };
  } catch (err) {
    return { ...base, exifAvailable: false, note: `Metadata could not be parsed: ${err.message}` };
  }
}

module.exports = { extractMetadata };
