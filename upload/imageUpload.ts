import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Buffer } from 'buffer';  // Required for handling base64 data

const HOSTNAME = 'la.storage.bunnycdn.com';
const STORAGE_ZONE_NAME = 'aiko-tv';
const ACCESS_KEY = process.env.BUNNY_STORAGE_API_KEY;

const saveTempImage = (buffer: Buffer, originalName: string): string => {
  const tempDir = path.join(os.tmpdir(), originalName);
  fs.writeFileSync(tempDir, buffer);
  return tempDir;
};

const uploadImageToBunnyCDN = async (filePath: string, fileName: string) => {
  const readStream = fs.createReadStream(filePath);

  const options = {
    method: 'PUT',
    host: HOSTNAME,
    path: `/${STORAGE_ZONE_NAME}/images/${fileName}`,
    headers: {
      AccessKey: ACCESS_KEY,
      'Content-Type': 'application/octet-stream',
    },
  };

  const req = https.request(options, (res) => {
    res.on('data', (chunk) => {
      console.log(chunk.toString('utf8'));
    });
  });

  req.on('error', (error) => {
    console.error(error);
  });

  readStream.pipe(req);
};

export const uploadToBunnyCDN = async (uploadedImageBuffer: Buffer, originalImageName: string) => {
  const tempImagePath = saveTempImage(uploadedImageBuffer, originalImageName);
  await uploadImageToBunnyCDN(tempImagePath, originalImageName);
  fs.unlinkSync(tempImagePath);
  return `https://aiko-tv.b-cdn.net/images/${originalImageName}`;
};

export const getExtensionFromMimetype = (mimetype) => {
  const mimeToExt = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    // Add more mimetypes as needed
  };
  return mimeToExt[mimetype] || "png";
};



