const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
const TEMP_UPLOAD_DIR = path.join(UPLOAD_DIR, 'temp');

function ensureUploadDirs() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

function createImageUpload({ temp = false } = {}) {
  ensureUploadDirs();

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, temp ? TEMP_UPLOAD_DIR : UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (extname && mimetype) {
        return cb(null, true);
      }
      cb(new Error('只允许上传图片文件（jpg, jpeg, png, webp）'));
    }
  });
}

function toPublicUploadPath(filename, { temp = false } = {}) {
  return `/uploads/${temp ? 'temp/' : ''}${filename}`.replace(/\\/g, '/');
}

function getDiskPathFromPublicPath(publicPath) {
  const normalized = String(publicPath || '').replace(/\\/g, '/');
  if (!normalized.startsWith('/uploads/')) {
    return null;
  }

  const relative = normalized.replace(/^\/uploads\//, '');
  const safeRelative = relative
    .split('/')
    .filter(Boolean)
    .map(part => path.basename(part))
    .join(path.sep);

  return path.join(UPLOAD_DIR, safeRelative);
}

function moveTempUploadToPermanent(publicPath) {
  const normalized = String(publicPath || '').replace(/\\/g, '/');
  if (!normalized.startsWith('/uploads/temp/')) {
    return normalized;
  }

  const filename = path.basename(normalized);
  const source = path.join(TEMP_UPLOAD_DIR, filename);
  const target = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(source)) {
    throw new Error('临时图片不存在或已过期，请重新识别');
  }

  fs.renameSync(source, target);
  return toPublicUploadPath(filename);
}

function removeUploadedImage(publicPath) {
  const diskPath = getDiskPathFromPublicPath(publicPath);
  if (diskPath && fs.existsSync(diskPath)) {
    fs.unlinkSync(diskPath);
  }
}

module.exports = {
  UPLOAD_DIR,
  TEMP_UPLOAD_DIR,
  ensureUploadDirs,
  createImageUpload,
  toPublicUploadPath,
  moveTempUploadToPermanent,
  removeUploadedImage
};
