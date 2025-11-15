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


// 地球の半径 (メートル)
const R = 6378137;
// 最大緯度 (メルカトル図法のクリップ用)
const MAX_LATITUDE = 85.0511287798;

/**
 * 経度(lon)をWebメルカトルX座標に変換
 */
export function mercatorX(lon) {
  // 経度をラジアンに変換し、半径を掛ける
  return R * (lon * Math.PI / 180);
}

/**
 * 緯度(lat)をWebメルカトルY座標に変換
 */
export function mercatorY(lat) {
  // 緯度をクリップ
  let latClamped = Math.max(Math.min(lat, MAX_LATITUDE), -MAX_LATITUDE);
  
  // 緯度をラジアンに変換
  let latRad = latClamped * Math.PI / 180;
  
  // メルカトル投影の計算
  // R * log(tan( (PI/4) + (latRad/2) ))
  return R * Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

export function createContinuousPoints(lonLatArray) {
    const points = [];
    let runningAdjustment = 0; // 経度の累積補正値

    for (let i = 0; i < lonLatArray.length; i++) {
        let lon = lonLatArray[i][0];
        const lat = lonLatArray[i][1];

        if (i > 0) {
            const prevOriginalLon = lonLatArray[i-1][0];
            const diff = lon - prevOriginalLon;

            // 180度以上のジャンプは日付変更線をまたいだと判断
            if (Math.abs(diff) > 180) { 
                runningAdjustment += (diff > 0 ? -360 : 360);
            }
        }
        points.push([lon + runningAdjustment, lat]);
    }
    return points;
}
