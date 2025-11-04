<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const mapContainer = ref(null)

const latlon2xyz = (lat, lon, radius = 1) => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)

    const x = - (radius * Math.sin(phi) * Math.cos(theta))
    const z = (radius * Math.sin(phi) * Math.sin(theta))
    const y = (radius * Math.cos(phi))

    return [x, y, z]
}

const tileImages = [
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58264/25819.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58265/25819.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58266/25819.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58267/25819.jpg',

    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58264/25820.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58265/25820.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58266/25820.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58267/25820.jpg',

    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58264/25821.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58265/25821.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58266/25821.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58267/25821.jpg',

    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58264/25822.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58265/25822.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58266/25822.jpg',
    'https://maps.gsi.go.jp/xyz/seamlessphoto/16/58267/25822.jpg',

]

const tileLatLon = tileImages.map((url) => {
    const parts = url.split('/')
    const z = parseInt(parts[5])
    const x = parseInt(parts[6])
    const y = parseInt(parts[7].split('.')[0])

    const n = Math.pow(2, z)
    const lon0_deg = x / n * 360.0 - 180.0
    const lat0_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)))
    const lat0_deg = lat0_rad * (180.0 / Math.PI)

    const lon1_deg = (x + 1) / n * 360.0 - 180.0
    const lat1_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n)))
    const lat1_deg = lat1_rad * (180.0 / Math.PI)

    return [lat0_deg, lon0_deg, lat1_deg, lon1_deg]
})  

const leftTop = tileLatLon[0]
const rightBottom = tileLatLon[tileLatLon.length - 1]
const leftTopLon = leftTop[1]
const leftTopLat = leftTop[0]
const rightBottomLon = rightBottom[3]
const rightBottomLat = rightBottom[2]

const leftTopX = mercatorX(leftTopLon)
const leftTopY = mercatorY(leftTopLat)
const rightBottomX = mercatorX(rightBottomLon)
const rightBottomY = mercatorY(rightBottomLat)

const setTileMaterial = async () => {
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

    const groundGeometry = new THREE.PlaneGeometry(10, 10)
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff })
    const loader = new THREE.TextureLoader()

    const canvas = document.createElement('canvas')
    canvas.width = 256 * 4
    canvas.height = 256 * 4
    const context = canvas.getContext('2d')
    const images = await loadImages(tileImages.flat())
    images.forEach((image, index) => {
        const x = (index % 4) * 256
        const y = Math.floor(index / 4) * 256
        context.drawImage(image, x, y, 256, 256)
    })
    const finalTexture = new THREE.CanvasTexture(canvas)
    groundMaterial.map = finalTexture
    groundMaterial.needsUpdate = true
    //groundGeometry.rotateX(- Math.PI / 2)

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)

    return groundMesh
}

function createContinuousPoints(lonLatArray) {
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
        points.push(new THREE.Vector2(lon + runningAdjustment, lat));
    }
    return points;
}


const drawRouteLine = (geojson, color, target) => {
    geojson.features.forEach(feature => {
        const coordinates = feature.geometry.coordinates
        const linePoints3D = coordinates.map(([lon, lat]) => {
            const x = ((mercatorX(lon) - leftTopX) / (rightBottomX - leftTopX) - 0.5) * 10
            const y = -((mercatorY(lat) - leftTopY) / (rightBottomY - leftTopY) - 0.5) * 10
            return new THREE.Vector3(x, y, 0.01)
        })
        const lineGeometry3D = new THREE.BufferGeometry().setFromPoints(linePoints3D)
        const lineMaterial3D = new THREE.LineBasicMaterial({ color })
        const line3D = new THREE.Line(lineGeometry3D, lineMaterial3D)
        target.add(line3D);
    })
}

onMounted(async () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
    const controls = new OrbitControls(camera, renderer.domElement)
    const axesHelper = new THREE.AxesHelper( 5 );
    //scene.add( axesHelper );

    const group = new THREE.Group()
    scene.add(group)

    const ambientLight = new THREE.AmbientLight(0xddddff, 2)
    scene.add(ambientLight)

    const groundMesh = await setTileMaterial()
    scene.add(groundMesh)

    const animate = function () {
        requestAnimationFrame(animate)
        renderer.render(scene, camera)
    }

    const loadGeoJSON = async (url) => {
        const response = await fetch(url)
        const data = await response.json()
        return data
    }

    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.x = 0 
    camera.position.y = -5
    camera.position.z = 12 
    camera.lookAt(new THREE.Vector3(0, 0, 0))

    const swimRoute = await loadGeoJSON('/data/day04/swim.geojson')
    const transition1Route = await loadGeoJSON('/data/day04/transition1.geojson')
    const bikeRoute = await loadGeoJSON('/data/day04/bike.geojson')
    const runRoute = await loadGeoJSON('/data/day04/run.geojson')

    drawRouteLine(swimRoute, 0x00ffff, group)
    drawRouteLine(transition1Route, 0xffff00, group)
    drawRouteLine(bikeRoute, 0x00ff00, group)
    drawRouteLine(runRoute, 0xff0000, group)

    animate()

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    })  
})

</script>

<template>
    <div ref="mapContainer" class="map-container">
    </div>
</template>

<style scoped>
.map-container {
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle at center,  #1d133bff, #000000, #1d133bff, #000000);
}
</style>