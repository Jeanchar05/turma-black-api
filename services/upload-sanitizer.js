"use strict";

const sharp = require("sharp");

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const MAX_IMAGE_EDGE = 8000;
const SAFE_INPUT_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
]);

function detectMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return "";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  const head6 = buffer.subarray(0, 6).toString("ascii");
  if (head6 === "GIF87a" || head6 === "GIF89a") return "image/gif";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return "";
}

function safeExtensionForMime(mime) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf"
  };
  return map[mime] || "";
}

function replaceExtension(name, mime) {
  const base = String(name || "arquivo")
    .replace(/[\x00-\x1f\x7f/\\]+/g, "_")
    .slice(0, 180)
    .replace(/\.[a-z0-9]{1,10}$/i, "") || "arquivo";
  return `${base}${safeExtensionForMime(mime)}`;
}

function validatePdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32 || buffer.length > MAX_FILE_SIZE) {
    throw Object.assign(new Error("PDF inválido."), { code: "UPLOAD_INVALID_PDF" });
  }

  const header = buffer.subarray(0, 8).toString("latin1");
  if (!/^%PDF-1\.[0-7]/.test(header)) {
    throw Object.assign(new Error("Cabeçalho PDF inválido."), { code: "UPLOAD_INVALID_PDF" });
  }

  const tail = buffer.subarray(Math.max(0, buffer.length - 4096)).toString("latin1");
  if (!/%%EOF\s*$/.test(tail)) {
    throw Object.assign(new Error("PDF incompleto ou truncado."), { code: "UPLOAD_TRUNCATED_PDF" });
  }

  // Suporte só precisa de documentos estáticos. Recursos ativos/embutidos não
  // são necessários e ampliam a superfície de ataque dos visualizadores PDF.
  const text = buffer.toString("latin1");
  const activeTokens = /\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|RichMedia|XFA)\b/i;
  if (activeTokens.test(text)) {
    throw Object.assign(new Error("PDF com conteúdo ativo não é permitido."), { code: "UPLOAD_ACTIVE_PDF" });
  }

  return {
    buffer: Buffer.from(buffer),
    mime: "application/pdf"
  };
}

async function sanitizeImage(buffer, detectedMime) {
  let image;
  try {
    image = sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
      animated: false,
      sequentialRead: true
    });

    const metadata = await image.metadata();
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (!width || !height || width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE || width * height > MAX_IMAGE_PIXELS) {
      throw Object.assign(new Error("Dimensões da imagem não permitidas."), { code: "UPLOAD_IMAGE_DIMENSIONS" });
    }

    // Reprocessar remove conteúdo excedente/metadados e garante que o arquivo
    // armazenado foi realmente decodificado como imagem. GIF é convertido para
    // PNG estático para evitar extensões/frames inesperados.
    let outputMime = detectedMime;
    let pipeline = image.rotate();
    if (detectedMime === "image/jpeg") pipeline = pipeline.jpeg({ quality: 90, progressive: true });
    else if (detectedMime === "image/png") pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    else if (detectedMime === "image/webp") pipeline = pipeline.webp({ quality: 90, effort: 5 });
    else {
      outputMime = "image/png";
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    }

    const sanitized = await pipeline.toBuffer();
    if (!sanitized.length || sanitized.length > MAX_FILE_SIZE) {
      throw Object.assign(new Error("Imagem processada excede o limite permitido."), { code: "UPLOAD_SANITIZED_TOO_LARGE" });
    }

    return { buffer: sanitized, mime: outputMime, width, height };
  } catch (error) {
    if (error?.code && String(error.code).startsWith("UPLOAD_")) throw error;
    throw Object.assign(new Error("A imagem está corrompida, truncada ou em formato inválido."), {
      code: "UPLOAD_IMAGE_DECODE_FAILED"
    });
  }
}

async function sanitizeUpload(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_FILE_SIZE) {
    throw Object.assign(new Error("O arquivo deve ter no máximo 4 MB."), { code: "UPLOAD_SIZE_INVALID" });
  }

  const detectedMime = detectMime(buffer);
  if (!SAFE_INPUT_MIMES.has(detectedMime)) {
    throw Object.assign(new Error("Tipo de arquivo não permitido."), { code: "UPLOAD_TYPE_INVALID" });
  }

  const informedMime = String(options.informedMime || "").trim().toLowerCase();
  if (
    informedMime &&
    informedMime !== detectedMime &&
    !(informedMime === "image/jpg" && detectedMime === "image/jpeg")
  ) {
    throw Object.assign(new Error("O tipo informado não corresponde ao conteúdo real do arquivo."), {
      code: "UPLOAD_MIME_MISMATCH"
    });
  }

  const result = detectedMime === "application/pdf"
    ? validatePdf(buffer)
    : await sanitizeImage(buffer, detectedMime);

  return {
    ...result,
    originalMime: detectedMime,
    name: replaceExtension(options.name, result.mime),
    size: result.buffer.length
  };
}

module.exports = {
  sanitizeUpload,
  detectMime,
  validatePdf,
  MAX_FILE_SIZE,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_EDGE
};
