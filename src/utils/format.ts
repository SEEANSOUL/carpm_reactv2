export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1)}K`.replace('.0K', 'K');
  }
  return String(n);
}

export function formatMembers(n: number): string {
  if (n >= 1000) {
    const v = n / 1000;
    return `${n % 1000 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  return String(n);
}
