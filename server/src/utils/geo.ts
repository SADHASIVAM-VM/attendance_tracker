/**
 * Calculates great-circle distance between two coordinates in meters using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 100) / 100; // round to 2 decimal places
}

export function isWithinGeofence(
  distanceMeters: number,
  radiusMeters: number,
  reportedAccuracyMeters: number = 0
): boolean {
  // Allow a realistic GPS drift tolerance buffer (up to 30m or half of accuracy)
  // This ensures workers standing near the boundary are not falsely blocked by satellite jitter
  const accuracyBuffer = Math.min(Math.max(reportedAccuracyMeters * 0.5, 10), Math.max(radiusMeters * 0.2, 35));
  return distanceMeters <= (radiusMeters + accuracyBuffer);
}

export function isAccuracyAcceptable(
  reportedAccuracy: number,
  maxAccuracyMeters: number
): boolean {
  // Allow realistic tolerance for indoor/mobile browser GPS readings (up to 150m)
  const effectiveMax = Math.max(maxAccuracyMeters, 150);
  return reportedAccuracy <= effectiveMax;
}
