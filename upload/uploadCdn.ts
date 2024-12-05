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

export const uploadAudioToBunnyCDN = async (req: any): Promise<string> => {
  const timestamp = Date.now();
  const fileName = `${timestamp}.mp3`;
  const filePath = path.join('/tmp', fileName);

  try {
    // Save audio file temporarily
    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      req.pipe(writeStream);

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`Audio file saved at ${filePath}`);

    // Upload to BunnyCDN
    const options = {
      method: 'PUT',
      host: 'la.storage.bunnycdn.com',
      path: `/aiko-tv/speech/${fileName}`,
      headers: {
        'AccessKey': process.env.BUNNY_STORAGE_API_KEY, // Your BunnyCDN API key from environment variables
        'Content-Type': 'audio/mpeg',
      },
    };

    // Perform the upload
    const publicUrl = await new Promise<string>((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      const uploadReq = https.request(options, (uploadRes) => {
        if (uploadRes.statusCode === 201) {
          const publicUrl = `https://aiko-tv.b-cdn.net/speech/${fileName}`;
          console.log("BunnyCDN upload successful", { publicUrl });
          resolve(publicUrl);
        } else {
          let data = '';
          uploadRes.on('data', chunk => data += chunk);
          uploadRes.on('end', () => {
            console.error("BunnyCDN upload failed", { statusCode: uploadRes.statusCode, response: data });
            reject(new Error(`Upload failed: ${data}`));
          });
        }
      });

      uploadReq.on('error', (error) => {
        console.error("Upload request error", error);
        reject(error);
      });

      fileStream.pipe(uploadReq);
    });

    // Clean up the temporary file after upload
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting temporary file", err);
      } else {
        console.log("Temporary file deleted");
      }
    });

    return publicUrl;
  } catch (error) {
    console.error("Error during audio upload:", error);
    throw new Error("Audio upload failed");
  }
};


