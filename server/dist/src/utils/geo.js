/**
 * Calculates great-circle distance between two coordinates in meters using the Haversine formula.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of Earth in meters
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // round to 2 decimal places
}
export function isWithinGeofence(distanceMeters, radiusMeters) {
    return distanceMeters <= radiusMeters;
}
export function isAccuracyAcceptable(reportedAccuracy, maxAccuracyMeters) {
    return reportedAccuracy <= maxAccuracyMeters;
}
