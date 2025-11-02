import { greatCircle } from "@turf/great-circle";

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

export const getLineArcPositionFromLatLon = (lat1, lon1, lat2, lon2, npoints = 32, radius = 1) => {
    const points = []
    if(lon1 - lon2 > 180) {
        lon2 += 360
    } else if(lon2 - lon1 > 180) {
        lon1 += 360
    }
    for(let i = 0; i <= npoints; i++) {
        const lat = lat1 + (lat2 - lat1) * (i / npoints)
        const lon = lon1 + (lon2 - lon1) * (i / npoints)
        const xyz = getPositionFromLatLon(lat, lon, radius)
        points.push(xyz)
    }
    return points
}

export const getGreatCircleFromLatLon = (lat1, lon1, lat2, lon2, npoints = 32) => {
    const point1 = { type: 'Point', coordinates: [lon1, lat1] }
    const point2 = { type: 'Point', coordinates: [lon2, lat2] }
    console.log(point1, point2)
    const line = greatCircle(point1, point2, { npoints })
    console.log(line)

    return line.geometry.coordinates
        .map(coods => coods.map(coord => {
            const [lon, lat] = coord
            return getPositionFromLatLon(lat, lon)
        }))
        .flat()
}