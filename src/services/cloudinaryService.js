const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

/**
 * Uploads a file buffer to Cloudinary and returns the permanent secure URL
 * plus the public_id (needed later for deletion / chain-of-custody).
 * resource_type: 'auto' lets Cloudinary correctly store images, videos,
 * audio, and raw files like PDFs.
 */
function uploadBuffer(buffer, { folder = 'veritas-evidence', originalFilename } = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
        filename_override: originalFilename
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

module.exports = { uploadBuffer };