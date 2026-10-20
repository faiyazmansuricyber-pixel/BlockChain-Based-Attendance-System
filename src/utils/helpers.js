// Helper utility functions

export function shortenAddress(address) {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  const date = new Date(ts * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeLeft(totalSeconds) {
  if (totalSeconds <= 0) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function exportToCSV(filename, rows, headers) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = headers.map(h => h.key);
  const headerRow = headers.map(h => `"${h.label}"`).join(separator);
  
  const contentRows = rows.map(row => {
    return keys.map(k => {
      let val = row[k] ?? '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(separator);
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headerRow, ...contentRows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateDemoOtpCode() {
  const array = new Uint32Array(1);
  (globalThis.crypto || window.crypto).getRandomValues(array);
  const code = 100000 + (array[0] % 900000);
  return String(code);
}
