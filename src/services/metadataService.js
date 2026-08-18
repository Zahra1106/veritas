const exifr = require('exifr');

/**
 * Extracts real metadata from an in-memory image buffer (EXIF/GPS/software
 * tags). Returns null fields gracefully when metadata is absent or the
 * file type doesn't support EXIF (e.g. video/audio).
 */
async function extractMetadata(buffer, mimeType, fileSizeBytes) {
  const base = { fileSizeBytes };

  if (!mimeType.startsWith('image/')) {
    return { ...base, exifAvailable: false, note: 'Metadata extraction is currently supported for images only.' };
  }

  try {
    const data = await exifr.parse(buffer, {
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