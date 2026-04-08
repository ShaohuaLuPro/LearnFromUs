const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
];

const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

function trimSlashes(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function getAllowedMimeTypes(rawValue) {
  const values = String(rawValue || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return values.length > 0 ? [...new Set(values)] : DEFAULT_ALLOWED_MIME_TYPES;
}

function sanitizeFileStem(fileName) {
  const stem = path.basename(String(fileName || ''), path.extname(String(fileName || '')));
  const normalized = stem
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return normalized || 'file';
}

function inferExtension(fileName, contentType) {
  const explicitExtension = path.extname(String(fileName || ''))
    .slice(1)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (explicitExtension) {
    return explicitExtension;
  }

  return MIME_EXTENSION_MAP[String(contentType || '').trim().toLowerCase()] || 'bin';
}

function encodeObjectKey(objectKey) {
  return String(objectKey || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function getMediaConfig(env = process.env) {
  const bucket = String(env.S3_BUCKET_NAME || '').trim();
  const region = String(env.AWS_REGION || '').trim();
  const publicBaseUrl = String(env.MEDIA_PUBLIC_BASE_URL || '').trim().replace(/\/+$/g, '');
  const uploadPrefix = trimSlashes(env.MEDIA_UPLOAD_PREFIX || 'uploads');
  const allowedMimeTypes = getAllowedMimeTypes(env.MEDIA_ALLOWED_MIME_TYPES);
  const maxUploadBytes = parsePositiveInteger(env.MEDIA_MAX_UPLOAD_BYTES, 10 * 1024 * 1024);
  const presignedUploadTtlSeconds = Math.min(
    parsePositiveInteger(env.MEDIA_UPLOAD_URL_TTL_SECONDS, 900),
    3600
  );
  const cacheControl = String(env.MEDIA_CACHE_CONTROL || 'public, max-age=31536000, immutable').trim();
  const accessKeyId = String(env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(env.AWS_SECRET_ACCESS_KEY || '').trim();
  const sessionToken = String(env.AWS_SESSION_TOKEN || '').trim();

  return {
    bucket,
    region,
    publicBaseUrl,
    uploadPrefix,
    allowedMimeTypes,
    maxUploadBytes,
    presignedUploadTtlSeconds,
    cacheControl,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    isConfigured: Boolean(bucket && region)
  };
}

function createS3Client(config) {
  if (!config.isConfigured) {
    return null;
  }

  const clientConfig = {
    region: config.region
  };

  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken || undefined
    };
  }

  return new S3Client(clientConfig);
}

function createMediaStorage(inputConfig = getMediaConfig()) {
  const config = inputConfig;
  const client = createS3Client(config);

  function ensureConfigured() {
    if (!config.isConfigured || !client) {
      throw new Error('S3 media storage is not configured.');
    }
  }

  function buildObjectKey({ assetId, userId, fileName, contentType }) {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const stem = sanitizeFileStem(fileName);
    const extension = inferExtension(fileName, contentType);

    return [
      config.uploadPrefix,
      String(userId || '').trim(),
      year,
      month,
      `${assetId}-${stem}.${extension}`
    ]
      .filter(Boolean)
      .join('/');
  }

  async function createUploadUrl({ assetId, userId, fileName, contentType, visibility }) {
    ensureConfigured();

    const objectKey = buildObjectKey({ assetId, userId, fileName, contentType });
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ContentType: contentType
    });
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: config.presignedUploadTtlSeconds
    });

    return {
      objectKey,
      uploadUrl,
      uploadHeaders: {
        'Content-Type': contentType
      },
      expiresAt: Date.now() + config.presignedUploadTtlSeconds * 1000
    };
  }

  async function headObject({ objectKey, bucket = config.bucket }) {
    ensureConfigured();
    return client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: objectKey
    }));
  }

  async function getObject({ objectKey, bucket = config.bucket }) {
    ensureConfigured();
    return client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey
    }));
  }

  async function deleteObject({ objectKey, bucket = config.bucket }) {
    ensureConfigured();
    return client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey
    }));
  }

  function buildAssetUrl({ objectKey, bucket = config.bucket, region = config.region }) {
    const encodedKey = encodeObjectKey(objectKey);
    if (config.publicBaseUrl) {
      return `${config.publicBaseUrl}/${encodedKey}`;
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
  }

  return {
    config,
    isConfigured() {
      return Boolean(config.isConfigured && client);
    },
    isAllowedMimeType(contentType) {
      return config.allowedMimeTypes.includes(String(contentType || '').trim().toLowerCase());
    },
    createUploadUrl,
    headObject,
    getObject,
    deleteObject,
    buildAssetUrl
  };
}

module.exports = {
  createMediaStorage,
  getMediaConfig
};
