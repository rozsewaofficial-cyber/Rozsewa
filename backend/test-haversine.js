const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    let distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return distanceKm;
};

// Indore coordinates
const pLat = 22.7196;
const pLon = 75.8577;

// Bhopal coordinates
const bLat = 23.2599;
const bLon = 77.4126;

const d1 = calculateDistance(pLat, pLon, bLat, bLon);
const d2 = calculateDistance(bLat, bLon, pLat, pLon);
console.log("Distance 1:", d1);
console.log("Distance 2:", d2);
