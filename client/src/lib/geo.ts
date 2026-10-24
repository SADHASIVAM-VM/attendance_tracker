/**
 * Calculates great-circle distance between two GPS coordinates in meters using the Haversine formula.
 *
 * Formula:
 * a = sin²(Δφ/2) + cos(φ1) ⋅ cos(φ2) ⋅ sin²(Δλ/2)
 * c = 2 ⋅ atan2( √a, √(1−a) )
 * d = R ⋅ c
 *
 * where:
 * φ is latitude in radians
 * λ is longitude in radians
 * R is Earth's mean radius in meters (6,371,000 m)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
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

  return Math.round(R * c * 100) / 100; // distance in meters rounded to 2 decimal places
}

/**
 * Checks if a distance in meters is within the worksite geofence radius.
 */
export function isWithinGeofence(
  distanceMeters: number,
  radiusMeters: number
): boolean {
  return distanceMeters <= radiusMeters;
}
