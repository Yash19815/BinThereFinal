export function getLevel(pct) {
  if (pct === null || pct === undefined) return "unknown";
  if (pct < 10) return "empty";
  if (pct < 50) return "low";
  if (pct < 80) return "medium";
  if (pct < 95) return "high";
  return "full";
}

export function getStatusLabel(pct) {
  if (pct === null || pct === undefined) return "—";
  if (pct < 10) return "Empty";
  if (pct < 50) return "Low";
  if (pct < 80) return "Medium";
  if (pct < 95) return "High";
  return "Full";
}

export function cellColor(value, max, type = "dry") {
  if (max === 0 || value === 0) {
    return "hsl(220, 22%, 14%)";
  }

  const intensity = value / max; // 0.0 – 1.0

  if (type === "dry") {
    // Dark mode: hsl(210, 75%, 24%) to hsl(210, 95%, 64%)
    const sat = Math.round(75 + intensity * 20);
    const light = Math.round(24 + intensity * 40);
    return `hsl(210, ${sat}%, ${light}%)`;
  } else {
    // Dark mode: hsl(145, 55%, 22%) to hsl(145, 72%, 58%)
    const sat = Math.round(55 + intensity * 17);
    const light = Math.round(22 + intensity * 36);
    return `hsl(145, ${sat}%, ${light}%)`;
  }
}
