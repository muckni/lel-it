export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/acad",
  "application/x-acad",
  "application/x-dwg",
  "image/vnd.dwg",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/svg+xml",
] as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".dwg",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".tif",
  ".tiff",
  ".svg",
] as const;

export function hasAllowedAttachmentType(
  input: { name: string; type?: string | null }
): boolean {
  const mime = (input.type ?? "").toLowerCase();
  if (
    mime.length > 0 &&
    ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      mime as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]
    )
  ) {
    return true;
  }

  const fileName = input.name.toLowerCase();
  return ALLOWED_ATTACHMENT_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
