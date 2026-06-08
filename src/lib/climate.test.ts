import { describe, it, expect } from 'vitest';
import { aggregateClimate } from './climate';

describe('aggregateClimate pure logic unit tests', () => {
  const identityGetCard = (s: any) => s.reflection_card;

  it('handles empty rows array and returns clean empty template structure', () => {
    const res = aggregateClimate([], identityGetCard);
    expect(res).toEqual({
      emotions: {},
      spheres: {},
      emotionsBySphere: {},
      timeline: [],
      totalSessions: 0
    });
  });

  it('ignores sessions that have no reflection card, while keeping totalSessions count intact', () => {
    const rows = [
      { started_at: '2026-06-01T10:00:00Z', reflection_card: null },
      { started_at: '2026-06-03T10:00:00Z', reflection_card: { prisme: 'Joie', sphere: 'Familiale' } }
    ];
    const res = aggregateClimate(rows, identityGetCard);
    expect(res.totalSessions).toBe(2);
    expect(res.emotions).toEqual({ joie: 1 });
    expect(res.spheres).toEqual({ Familiale: 1 });
  });

  it('properly reads emotions from prisme, rune, or emotion fields and lowercases them', () => {
    const rows = [
      { started_at: '2026-06-01T10:00:00Z', reflection_card: { prisme: 'JOIE', sphere: 'Familiale' } },
      { started_at: '2026-06-03T10:00:00Z', reflection_card: { rune: 'Tristesse', sphere: 'Sociale' } },
      { started_at: '2026-06-05T10:00:00Z', reflection_card: { emotion: 'Colère', sphere: 'Amoureuse' } }
    ];
    const res = aggregateClimate(rows, identityGetCard);
    expect(res.emotions).toEqual({
      joie: 1,
      tristesse: 1,
      'colère': 1
    });
  });

  it('correctly groups and aggregates multiple sessions over distinct weekly periods with dominant emotion selection', () => {
    // 2026-06-01 is Monday, 2026-06-03 is Wednesday, 2026-06-04 is Thursday
    // 2026-06-09 is Tuesday of the following week (week starting Mon 2026-06-08)
    const rows = [
      {
        started_at: '2026-06-01T10:00:00Z',
        reflection_card: { prisme: 'Joie', sphere: 'Familiale' }
      },
      {
        started_at: '2026-06-03T15:30:00Z',
        reflection_card: { prisme: 'Joie', sphere: 'Familiale' }
      },
      {
        started_at: '2026-06-04T08:00:00Z',
        reflection_card: { rune: 'Tristesse', sphere: 'Familiale' }
      },
      {
        started_at: '2026-06-09T12:00:00Z',
        reflection_card: { emotion: 'Colere', sphere: 'Sociale' }
      }
    ];

    const res = aggregateClimate(rows, identityGetCard);

    // Verify aggregate totals
    expect(res.totalSessions).toBe(4);
    expect(res.emotions).toEqual({
      joie: 2,
      tristesse: 1,
      colere: 1
    });
    expect(res.spheres).toEqual({
      Familiale: 3,
      Sociale: 1
    });

    // Verify nested emotionsBySphere layout
    expect(res.emotionsBySphere).toEqual({
      Familiale: {
        joie: 2,
        tristesse: 1
      },
      Sociale: {
        colere: 1
      }
    });

    // Verify weekly buckets sorting and timeline values
    expect(res.timeline.length).toBe(2);
    // Chronologically sorted
    expect(res.timeline[0].period).toBe('2026-06-01');
    expect(res.timeline[1].period).toBe('2026-06-08');

    // Week 1 timeline details
    expect(res.timeline[0].total).toBe(3);
    expect(res.timeline[0].emotions).toEqual({
      joie: 2,
      tristesse: 1
    });
    expect(res.timeline[0].dominant).toBe('joie');

    // Week 2 timeline details
    expect(res.timeline[1].total).toBe(1);
    expect(res.timeline[1].emotions).toEqual({
      colere: 1
    });
    expect(res.timeline[1].dominant).toBe('colere');
  });
});
