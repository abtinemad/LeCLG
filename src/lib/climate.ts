/**
 * Pure helper for climate statistics aggregation.
 * Easily testable and isolated from decryption/encryption.
 */
export function aggregateClimate(
  rows: any[],
  getCard: (row: any) => any | null
): any {
  const stats: any = {
    emotions: {},
    spheres: {},
    emotionsBySphere: {},
    timeline: [],
    totalSessions: Array.isArray(rows) ? rows.length : 0
  };
  const weekly: any = {};

  if (Array.isArray(rows)) {
    rows.forEach((s: any) => {
      const reflectionCard = getCard(s);
      if (!reflectionCard) return;

      const emotion = (reflectionCard.prisme || reflectionCard.rune || reflectionCard.emotion || "").toLowerCase();
      const sphere = reflectionCard.sphere;

      if (emotion) stats.emotions[emotion] = (stats.emotions[emotion] || 0) + 1;
      if (sphere) stats.spheres[sphere] = (stats.spheres[sphere] || 0) + 1;

      if (emotion && sphere) {
        if (!stats.emotionsBySphere[sphere]) stats.emotionsBySphere[sphere] = {};
        stats.emotionsBySphere[sphere][emotion] = (stats.emotionsBySphere[sphere][emotion] || 0) + 1;
      }

      const rawDate = s.started_at || s.created_at || s.inserted_at || s.createdAt || s.created || reflectionCard.date || null;
      if (emotion && rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          const dow = (d.getUTCDay() + 6) % 7; // 0 = Lundi / Monday
          const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
          const key = monday.toISOString().slice(0, 10);
          if (!weekly[key]) weekly[key] = { total: 0, emotions: {} };
          weekly[key].total += 1;
          weekly[key].emotions[emotion] = (weekly[key].emotions[emotion] || 0) + 1;
        }
      }
    });
  }

  stats.timeline = Object.keys(weekly).sort().map((period) => {
    const b = weekly[period];
    let dominant: string | null = null;
    let max = -1;
    for (const emo of Object.keys(b.emotions)) {
      if (b.emotions[emo] > max) {
        max = b.emotions[emo];
        dominant = emo;
      }
    }
    return { period, total: b.total, emotions: b.emotions, dominant };
  });

  return stats;
}
