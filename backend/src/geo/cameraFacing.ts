/**
 * Whether a camera facing `directionDegrees` (compass bearing, 0 = Bắc, clockwise) with a
 * `fovDegrees`-wide lens can see a point lying at `bearingDegrees` from the camera. Used to
 * flag "gần nhưng camera không hướng tới" separately from plain distance — a camera 50m away
 * pointed the opposite direction is not actually useful for a given report.
 *
 * The `% 360` normalization handles wraparound near 0°/360° (e.g. direction=350°, fov=60°
 * must still count bearing=10° as facing, even though naive subtraction gives 340° apart).
 */
export function isFacingBearing(directionDegrees: number, fovDegrees: number, bearingDegrees: number): boolean {
  const diff = ((bearingDegrees - directionDegrees + 540) % 360) - 180;
  return Math.abs(diff) <= fovDegrees / 2;
}
