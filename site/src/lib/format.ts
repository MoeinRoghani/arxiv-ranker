const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function truncateAuthors(authors: string, max = 160): string {
  if (!authors) return '';
  return authors.length > max ? authors.slice(0, max) + '...' : authors;
}

export function tierClass(tier: string): string {
  if (tier.includes('LANDMARK')) return 'landmark';
  if (tier.includes('IMPORTANT')) return 'important';
  return 'notable';
}

export function tierLabel(tier: string): string {
  if (tier.includes('LANDMARK')) return 'Landmark';
  if (tier.includes('IMPORTANT')) return 'Important';
  return 'Notable';
}
