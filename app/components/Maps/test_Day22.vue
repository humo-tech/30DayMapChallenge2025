<script setup>
import { Plane } from 'babylonjs'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const mapContainer = ref(null)
let zoom = 5
let center = { lat: 35.681236, lon: 139.767125 } // Tokyo Station

const lat2y = (lat) => {
    const latRad = lat * Math.PI / 180
    const n = Math.pow(2, zoom)
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n * 256
    return y
}  
const lon2x = (lon) => {
    const n = Math.pow(2, zoom)
    const x = (lon + 180) / 360 * n * 256
    return x
}

const x2lon = (x) => {
    const n = Math.pow(2, zoom)
    const lon = (x / (n * 256)) * 360 - 180
    return lon
}
const y2lat = (y) => {
    const n = Math.pow(2, zoom)
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (y / (n * 256)) * 2)))
    const lat = latRad * 180 / Math.PI
    return lat
}

/**
 * 画面内のXY座標を緯度経度に変換する
 * @param x
 * @param y
 * @returns {lat, lon}
 */
const xy2latlon = (x, y) => {
    const n = Math.pow(2, zoom)
    const lon = (x / (n * 256)) * 360 - 180
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (y / (n * 256)) * 2)))
    const lat = latRad * 180 / Math.PI
    return { lat, lon }
}


/**
 * ウィンドウの範囲に含まれるタイルの座標を計算する
 */
const getWindowBounds = (tileSize = 256) => {
    const n = Math.pow(2, zoom)

    const centerX = lon2x(center.lon)
    const centerY = lat2y(center.lat)

    const halfWidth = window.innerWidth / 2
    const halfHeight = window.innerHeight / 2

    const minX = centerX - halfWidth
    const maxX = centerX + halfWidth
    const minY = centerY - halfHeight
    const maxY = centerY + halfHeight

    const maxLat = y2lat(minY)
    const minLat = y2lat(maxY)
    const maxLon = x2lon(maxX)
    const minLon = x2lon(minX)
    console.log(maxLat, minLat, maxLon, minLon)

    return { 
        minX, maxX, minY, maxY, n, tileSize, 
        latLonBounds: [minLat, minLon, maxLat, maxLon] 
    }
}

/**
 * ウィンドウの範囲に含まれるタイルのリストを取得する
 */
const getTilesInView = () => {
    const { minX, maxX, minY, maxY, n, tileSize } = getWindowBounds()

    const minTileX = Math.floor(minX / tileSize)
    const maxTileX = Math.floor(maxX / tileSize)
    const minTileY = Math.floor(minY / tileSize)
    const maxTileY = Math.floor(maxY / tileSize)

    let tileLatMin, tileLonMin, tileLatMax, tileLonMax
    const tiles = []
    for (let x = minTileX; x <= maxTileX; x++) {
        const wrappedX = ((x % n) + n) % n
        const nn = Math.pow(2, zoom)
        const _tileLonMin = x / nn * 360.0 - 180.0
        const _tileLonMax = (x + 1) / nn * 360.0 - 180.0
        if (tileLonMin === undefined || _tileLonMin < tileLonMin) tileLonMin = _tileLonMin
        if (tileLonMax === undefined || _tileLonMax > tileLonMax) tileLonMax = _tileLonMax

        for (let y = minTileY; y <= maxTileY; y++) {
            if (y >= 0 && y < n) {
                // calculate tile lat/lon bounds
                const latMaxRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / nn)))
                const _tileLatMax = latMaxRad * (180.0 / Math.PI)
                const latMinRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / nn)))
                const _tileLatMin = latMinRad * (180.0 / Math.PI)
                if (tileLatMax === undefined || _tileLatMax > tileLatMax) tileLatMax = _tileLatMax
                if (tileLatMin === undefined || _tileLatMin < tileLatMin) tileLatMin = _tileLatMin
                //console.log(`Tile x:${wrappedX}, y:${y}, z:${zoom}, lat:[${_tileLatMin}, ${_tileLatMax}], lon:[${_tileLonMin}, ${_tileLonMax}]`)    
                //console.log(tileLatMax, tileLatMin, tileLonMax, tileLonMin)
                tiles.push({ x: wrappedX, y: y, z: zoom })
            }
        }
    }
    const tileCenter = {
        lat: (tileLatMin + tileLatMax) / 2,
        lon: (tileLonMin + tileLonMax) / 2
    }
    return { tiles, xTileNumber: maxTileX - minTileX + 1, yTileNumber: maxTileY - minTileY + 1, minTileX, minTileY, latLonBounds: { minLat: tileLatMin, minLon: tileLonMin, maxLat: tileLatMax, maxLon: tileLonMax } , tileCenter }
}

/**
 * タイルURLを取得する
 * @param baseUrl 
 * @returns 
 */
const getTileURL = (baseUrl) => (x, y, z) => {
    return baseUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y)
}

/**
 * タイルのURLリストを取得する
 * @param baseUrl string
 * @param tiles {x, y, z}[]
 */
const getTileURLs = (baseUrl, tiles) => {
    const tileURLFunc = getTileURL(baseUrl)
    return tiles.map(tile => tileURLFunc(tile.x, tile.y, tile.z))
}

/**
 * タイル画像のリストからタイルメッシュを作成する
 * @param baseUrl ベースのURL
 * @param tileImageInfo タイル画像情報
 * @param tileImageInfo.tiles タイル画像の{x,y,z}リスト
 * @param tileImageInfo.xTileNumber x方向のタイル数
 * @param tileImageInfo.yTileNumber y方向のタイル数
 * @param tileImageInfo.minTileX x方向の最小タイル番号
 * @param tileImageInfo.minTileY y方向の最小タイル番号
 * @param tileSize タイル画像のピクセル数
 */
const createTileMesh = async (baseUrl, { tiles, xTileNumber, yTileNumber, minTileX, minTileY }, tileSize = 256) => {
    const loadImage = (url) => {
        return new Promise((resolve) => {
            const image = new Image()
            image.crossOrigin = 'Anonymous'
            image.src = url
            image.onload = () => {
                resolve(image)
            }
        })
    }

    const loadImages = async (urls) => {
        const promises = urls.map(url => loadImage(url))
        const images = await Promise.all(promises)
        return images
    }

    const tileUrlList = getTileURLs(baseUrl, tiles)
    const groundGeometry = new THREE.PlaneGeometry(xTileNumber * tileSize, yTileNumber * tileSize)

    const canvas = document.createElement('canvas')
    canvas.width = tileSize * xTileNumber
    canvas.height = tileSize * yTileNumber
    const context = canvas.getContext('2d')
    const images = await loadImages(tileUrlList)
    images.forEach((image, index) => {
        const x = (tiles[index].x - minTileX) * tileSize
        const y = (tiles[index].y - minTileY) * tileSize
        context.drawImage(image, x, y, tileSize, tileSize)
    })

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = 'srgb'
    const groundMaterial = new THREE.MeshBasicMaterial({ 
        map: texture
     })

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)
    return groundMesh
}


onMounted(async () => {
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0xff0000, 1) // 背景を透明に設定

    // controls without pitch, only pan and zoom
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableRotate = false
    controls.enableZoom = true
    controls.enablePan = true
    controls.zoomSpeed = 1.2
    controls.maxZoom = 20
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    }

    // track controls changes
    controls.addEventListener('change', (event) => {
        // update center lat, lon and zoom
        //console.log(controls.target)
        const newCenterX = controls.target.x + (window.innerWidth / 2)
        const newCenterY = controls.target.y + (window.innerHeight / 2)
        const n = Math.pow(2, zoom)
        const lon = (newCenterX / (n * 256)) * 360 - 180
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - (newCenterY / (n * 256)))))
        const lat = latRad * 180 / Math.PI
        center.lat = lat
        center.lon = lon
        zoom = Math.round(controls.target.z)
        //console.log(`Center: ${center.lat}, ${center.lon}, Zoom: ${zoom}`)
    })
    
    const ambientLight = new THREE.AmbientLight(0xf5f5f5, 2)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 5, 5)
    scene.add(sunLight)

    const group = new THREE.Group()
    scene.add(group)

    const tileImageInfo = getTilesInView()
    const tileMesh = await createTileMesh(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        tileImageInfo,
        256
    )
    // center the tile mesh
    const diffX = lon2x(tileImageInfo.tileCenter.lon) - lon2x(center.lon)
    const diffY = lat2y(tileImageInfo.tileCenter.lat) - lat2y(center.lat)
    console.log('diffX:', diffX, 'diffY:', diffY)
    tileMesh.position.x = diffX
    tileMesh.position.y = diffY

    group.add(tileMesh)

    const animate = function () {
        requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
    }

    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.x = 0 
    camera.position.y = 0
    camera.position.z = 10
    camera.lookAt(new THREE.Vector3(0, 0, 0))

    animate()

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    })  
})

</script>

<template>
    <div ref="mapContainer" class="map-container"></div>
    <div class="center-cross"></div>
    <footer>Natural Earth</footer>
</template>

<style scoped>
h2 {
    position: absolute;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    z-index: 1;
    font-family: 'Arial', sans-serif;
    background-color: rgba(0, 0, 0, 0.8);
    padding: 10px 15px;
    border-radius: 8px;
}
.center-cross {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    background: transparent;
    transform: translate(-50%, -50%);
    pointer-events: none;
}
.center-cross::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 2px;
    background: red;
    transform: translateY(-50%);
}
.center-cross::after {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    width: 2px;
    height: 100%;
    background: red;
    transform: translateX(-50%);
}
footer {
    position: absolute;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    z-index: 1;
    font-family: 'Arial', sans-serif;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 5px 10px;
    border-radius: 8px;
    font-size: 14px;
}
.map-container {
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle at center, #e8f4f8, #f0f8ff, #e8f4f8, #ffffff);
}
</style>