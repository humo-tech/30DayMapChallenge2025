<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

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
    'https://tile.openstreetmap.jp/styles/osm-bright/9/453/200.jpg',
    'https://tile.openstreetmap.jp/styles/osm-bright/9/454/200.jpg',
    'https://tile.openstreetmap.jp/styles/osm-bright/9/455/200.jpg',

    'https://tile.openstreetmap.jp/styles/osm-bright/9/453/201.jpg',
    'https://tile.openstreetmap.jp/styles/osm-bright/9/454/201.jpg',
    'https://tile.openstreetmap.jp/styles/osm-bright/9/455/201.jpg',

    'https://tile.openstreetmap.jp/styles/osm-bright/9/453/202.jpg',
    'https://tile.openstreetmap.jp/styles/osm-bright/9/454/202.jpg',
    'https://tile.openstreetmap.jp/styles/osm-bright/9/455/202.jpg',
]

const size = Math.sqrt(tileImages.length)

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
    const loader = new THREE.TextureLoader()

    const canvas = document.createElement('canvas')
    canvas.width = 256 * size 
    canvas.height = 256 * size
    const context = canvas.getContext('2d')
    const images = await loadImages(tileImages.flat())
    images.forEach((image, index) => {
        const x = (index % size) * 256
        const y = Math.floor(index / size) * 256
        context.drawImage(image, x, y, 256, 256)
    })
    const canvasTexture = new THREE.CanvasTexture(canvas)
    //canvasTexture.encoding = THREE.sRGBEncoding
    canvasTexture.colorSpace = 'srgb'
    const groundMaterial = new THREE.MeshBasicMaterial({ 
        map: canvasTexture
    })
    //groundGeometry.rotateX(- Math.PI / 2)

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)

    return groundMesh
}

const loadGeoJSON = async (url) => {
    const response = await fetch(url)
    const data = await response.json()
    return data
}

onMounted(async () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
    const controls = new OrbitControls(camera, renderer.domElement)

    const group = new THREE.Group()
    scene.add(group)

    const groundMesh = await setTileMaterial()
    scene.add(groundMesh)

    const animate = function () {
        requestAnimationFrame(animate)
        renderer.render(scene, camera)
    }

    const geojson = await loadGeoJSON(`${baseUrl}/data/day14/export.geojson`)
    geojson.features.forEach((feature) => {
        if(feature.geometry.type === 'Point'){
            const coordinates = feature.geometry.coordinates
            const [lon, lat] = coordinates
            const x = ((mercatorX(lon) - leftTopX) / (rightBottomX - leftTopX) - 0.5) * 10
            const y = -((mercatorY(lat) - leftTopY) / (rightBottomY - leftTopY) - 0.5) * 10
            const geometry = new THREE.SphereGeometry(0.1, 16, 16)
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, 0.0)
            group.add(mesh)
        }
    })

    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.x = 0 
    camera.position.y = -5
    camera.position.z = 12 
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