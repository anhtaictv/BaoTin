import { describe, expect, it } from 'vitest';
import { cameraConePolygon } from './cameraCone';

const CENTER = { lat: 12.68, lng: 108.05 };

describe('cameraConePolygon', () => {
  it('starts and ends at the camera position, framing a closed fan shape', () => {
    const points = cameraConePolygon(CENTER, 90, 60);
    expect(points[0]).toEqual([CENTER.lat, CENTER.lng]);
    expect(points[points.length - 1]).toEqual([CENTER.lat, CENTER.lng]);
  });

  it('returns one arc point per segment plus the two center points', () => {
    const points = cameraConePolygon(CENTER, 0, 90, 60, 8);
    expect(points).toHaveLength(8 + 1 + 2);
  });

  it('a camera facing due east (90°) moves the arc points east, not north/south', () => {
    const points = cameraConePolygon(CENTER, 90, 10, 60, 4);
    const arcPoints = points.slice(1, -1);
    for (const [lat, lng] of arcPoints) {
      expect(lng).toBeGreaterThan(CENTER.lng);
      expect(lat).toBeCloseTo(CENTER.lat, 3);
    }
  });

  it('a camera facing due north (0°) moves the arc points north, not east/west', () => {
    const points = cameraConePolygon(CENTER, 0, 10, 60, 4);
    const arcPoints = points.slice(1, -1);
    for (const [lat, lng] of arcPoints) {
      expect(lat).toBeGreaterThan(CENTER.lat);
      expect(lng).toBeCloseTo(CENTER.lng, 3);
    }
  });
});
