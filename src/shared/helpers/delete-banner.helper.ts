import { unlink } from 'fs/promises';
import { join } from 'path';

const BANNER_MARKER = '/api/static/banners/';

/**
 * Удаляет локальный файл баннера, если URL указывает на /static/banners/.
 * Игнорирует ошибку, если файл уже не существует.
 */
export async function deleteBannerIfLocal(
  url: string | null | undefined,
): Promise<void> {
  if (!url) return;
  const idx = url.indexOf(BANNER_MARKER);
  if (idx === -1) return;
  const filename = url.slice(idx + BANNER_MARKER.length);
  if (!filename) return;
  try {
    await unlink(join(process.cwd(), 'static', 'banners', filename));
  } catch {
    // файл уже удалён или не существует — нормальная ситуация
  }
}
