import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function paiseToCsvAmount(paise: number | null | undefined): string {
  if (paise == null || Number.isNaN(paise)) return '';
  return (paise / 100).toFixed(2);
}

export function sanitizeCsvFilename(name: string): string {
  const trimmed = name.trim() || 'export';
  const base = trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base.toLowerCase().endsWith('.csv') ? base : `${base}.csv`;
}

export function buildCsvDocument(
  metadata: Array<[string, string]>,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  title = 'Payment History Export',
): string {
  const lines: string[] = [`# VSYK Chits — ${title}`];

  for (const [key, value] of metadata) {
    lines.push(`# ${escapeCsvCell(key)},${escapeCsvCell(value)}`);
  }

  lines.push('');
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return lines.join('\n');
}

function writeCsvToCache(filename: string, content: string): File {
  const exportsDir = new Directory(Paths.cache, 'vsyk-exports');
  if (!exportsDir.exists) {
    exportsDir.create({ idempotent: true });
  }

  const file = new File(exportsDir, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(content);
  return file;
}

export async function shareCsvFile(options: {
  filename: string;
  content: string;
  dialogTitle?: string;
}): Promise<void> {
  const filename = sanitizeCsvFilename(options.filename);
  const content = `\uFEFF${options.content}`;

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const file = writeCsvToCache(filename, content);
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('File sharing is not available on this device.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: options.dialogTitle ?? 'Export payment history',
  });
}
