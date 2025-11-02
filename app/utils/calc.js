/**
 * Convert latitude and longitude to 3D position on a sphere
 * @param {Number} lat 
 * @param {Number} lon 
 * @param {Number} [radius = 1]
 * @returns {Array} [x, y, z]
 */
export const getPositionFromLatLon = (lat, lon, radius = 1) => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)

    const x = -radius * Math.sin(phi) * Math.cos(theta)
    const y = radius * Math.cos(phi)
    const z = radius * Math.sin(phi) * Math.sin(theta)

    return [x, y, z]
}

