import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Buffer } from 'buffer';  // Required for handling base64 data

const HOSTNAME = 'la.storage.bunnycdn.com';
const STORAGE_ZONE_NAME = 'aiko-tv';
const ACCESS_KEY = process.env.BUNNY_STORAGE_API_KEY;

const saveTempFile = (buffer: Buffer, originalName: string): string => {
  const tempDir = path.join(os.tmpdir(), originalName);
  fs.writeFileSync(tempDir, buffer);
  return tempDir;
};

export const uploadImgToBunnyCDN = async (uploadedImageBuffer: Buffer, originalImageName: string) => {
  const tempImagePath = saveTempFile(uploadedImageBuffer, originalImageName);
  const readStream = fs.createReadStream(tempImagePath);

  const options = {
    method: 'PUT',
    host: HOSTNAME,
    path: `/${STORAGE_ZONE_NAME}/userImages/${originalImageName}`,
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
  fs.unlinkSync(tempImagePath);
  return `https://aiko-tv.b-cdn.net/userImages/${originalImageName}`;
};

export const uploadVrmToBunnyCDN = async (uploadedVrmBuffer: Buffer, originalVrmName: string) => {
  const tempVrmPath = saveTempFile(uploadedVrmBuffer, originalVrmName);
  const readStream = fs.createReadStream(tempVrmPath);

  const options = {
    method: 'PUT',
    host: HOSTNAME,
    path: `/${STORAGE_ZONE_NAME}/models/${originalVrmName}`,
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
    if (error) {
      fs.unlinkSync(tempVrmPath);
      return null;
    }
  });
  readStream.pipe(req);
  fs.unlinkSync(tempVrmPath);
  return `https://aiko-tv.b-cdn.net/models/${originalVrmName}`;
};

export const getExtensionFromMimetype = (mimetype) => {
  const mimeToExt = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "model/vnd.vrm": "vrm",
    "application/octet-stream": "vrm",
    // Add more mimetypes as needed
  };
  return mimeToExt[mimetype] || "png";
};

export const uploadAudioToBunnyCDN = async (audioBuffer: Buffer): Promise<string> => {
  const timestamp = Date.now();
  const fileName = `${timestamp}.mp3`;

  try {
    const options = {
      method: 'PUT',
      host: 'la.storage.bunnycdn.com',
      path: `/aiko-tv/speech/${fileName}`,
      headers: {
        'AccessKey': process.env.BUNNY_STORAGE_API_KEY || '',
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length, // Correct usage of audioBuffer
      },
    };

    const publicUrl = await new Promise<string>((resolve, reject) => {
      const uploadReq = https.request(options, (uploadRes) => {
        const isSuccess = [200, 201].includes(uploadRes.statusCode || 0);
        if (isSuccess) {
          const publicUrl = `https://aiko-tv.b-cdn.net/speech/${fileName}`;
          console.log("BunnyCDN upload successful", { publicUrl });
          resolve(publicUrl);
        } else {
          let data = '';
          uploadRes.on('data', chunk => data += chunk);
          uploadRes.on('end', () => {
            reject(new Error(`Upload failed with status ${uploadRes.statusCode}: ${data}`));
          });
        }
      });

      uploadReq.on('error', (error) => reject(error));

      uploadReq.write(audioBuffer); // Write the audio buffer to the request
      uploadReq.end();
    });

    return publicUrl;
  } catch (error) {
    throw new Error("Audio upload failed");
  }
};


