// ── Report utility functions ──────────────────────────────────────────────────

export function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function contentToHtml(name: string, content: string, isMarkdown: boolean): string {
  // For markdown, wrap in a styled HTML shell
  if (isMarkdown) {
    return `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="UTF-8"><title>${name}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#f3f0ff;background:#0f051a}
pre{background:#1a0e2e;padding:16px;border-radius:8px;overflow-x:auto}code{font-family:monospace}
a{color:#a855f7}h1,h2,h3{color:#f3f0ff}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #2d1b4e;padding:8px 12px;text-align:left}th{background:#1a0e2e}</style>
</head><body><pre style="white-space:pre-wrap">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
  }
  return content;
}
