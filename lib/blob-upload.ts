/**
 * Blob upload helper.
 * Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set;
 * falls back to writing into public/ for local development.
 */
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export async function uploadFile(
  file: File,
  filename: string,
): Promise<{ url: string }> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (blobToken) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    });
    return { url: blob.url };
  }

  // Dev fallback: write to public/<filename>
  const buffer = Buffer.from(await file.arrayBuffer());
  const localPath = path.join(process.cwd(), "public", filename);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, buffer);

  // Return a path relative to the Next.js public directory
  return { url: `/${filename}` };
}

/**
 * Delete a previously uploaded file.
 * In dev (no blob token), deletes from public/ if the URL is a local path.
 */
export async function deleteFile(url: string): Promise<void> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (blobToken) {
    const { del } = await import("@vercel/blob");
    await del(url);
    return;
  }

  // Dev fallback: delete local file if URL is a relative path
  if (url.startsWith("/") && !url.startsWith("//")) {
    try {
      const localPath = path.join(process.cwd(), "public", url);
      await unlink(localPath);
    } catch {
      // Best effort — ignore if file doesn't exist
    }
  }
}

