<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''
const name = ref('mercator')
let rotateFlag = false

const mapContainer = ref(null)
const planeSize = 25
const z = 3

const latlon2xyz = (lat, lon, radius = 1) => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)

    const x = - (radius * Math.sin(phi) * Math.cos(theta))
    const z = (radius * Math.sin(phi) * Math.sin(theta))
    const y = (radius * Math.cos(phi))

    return [x, y, z]
}

const mercatorToLat = (ty) => {
    const n = Math.PI - 2 * Math.PI * ty
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}
const mercatorToLon = (tx) => {
    return tx * 360 - 180
}

const tileImages = []
const tileUrl = 'https://tile.openstreetmap.jp/styles/osm-bright/{z}/{x}/{y}.jpg'
for(let y = 0; y < Math.pow(2, z); y++) {
     for(let x = 0; x < Math.pow(2, z); x++) {
        tileImages.push(
            tileUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y)
        )
    }
}

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

    const groundGeometry = new THREE.PlaneGeometry(planeSize, planeSize, 64, 64)
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
        map: canvasTexture,
        //wireframe: true
    })
    //groundGeometry.rotateX(- Math.PI / 2)

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)

    return groundMesh
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
    group.add(groundMesh)

    const animate = function () {
        requestAnimationFrame(animate)
        if(rotateFlag) {
            camera.position.y += 0.005
            camera.lookAt(new THREE.Vector3(0, 0, 0))
            group.rotation.y += 0.003
        }
        renderer.render(scene, camera)
    }

    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.x = 0 
    camera.position.y = 0
    camera.position.z = 16 
    camera.lookAt(new THREE.Vector3(0, 0, 0))

    const doTransition = (currentPositions, newPositions, progress) => {
        const position = groundMesh.geometry.attributes.position
        for (let i = 0; i < position.count; i++) {
            const [cx, cy, cz] = currentPositions[i]
            const [nx, ny, nz] = newPositions[i]
            const x = cx + (nx - cx) * progress
            const y = cy + (ny - cy) * progress
            const z = cz + (nz - cz) * progress
            position.setXYZ(i, x, y, z)
        }
        position.needsUpdate = true
    }

    const transition = (duration, currentPositions, newPositions) => {
        return new Promise((resolve) => {
            let start = null
            const step = (timestamp) => {
                if (!start) start = timestamp
                const elapsed = timestamp - start
                const progress = Math.min(elapsed / duration, 1.0)
                doTransition(currentPositions, newPositions, progress)
                if (elapsed < duration) {
                    requestAnimationFrame(step)
                } else {
                    resolve()
                }
            }
            requestAnimationFrame(step)
        })
    }

    setTimeout(() => {
        const position = groundMesh.geometry.attributes.position
        const currentPositions = []
        const newPositions = []
        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i)
            const y = position.getY(i)
            const tx = (x / planeSize + 0.5) // 0 to 1
            const ty = 1.0 - (y / planeSize + 0.5) // 0 to 1
            const lon = mercatorToLon(tx)
            const lat = mercatorToLat(ty)
            const newX = ((lon - -180) / 360 - 0.5) * planeSize
            const newY = ((lat - 90) / 180 + 0.5) *  (planeSize / 2) // -2.5 to 2.5
            currentPositions.push([x, y, 0])
            newPositions.push([newX, newY, 0])
        }
        name.value = 'ecquirectangular'
        transition(500, currentPositions, newPositions)
    }, 3000)
    const loadGeoJSON = async (url) => {
        const response = await fetch(url)
        const data = await response.json()
        return data
    }
    setTimeout(async () => {
        // positionを球体の頂点位置に置き換える
        const position = groundMesh.geometry.attributes.position
        const currentPositions = []
        const newPositions = []
        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i)
            const y = position.getY(i)
            const lon = x / planeSize * 360
            const lat = y / (planeSize / 2) * 180
            const [newX, newY, newZ] = latlon2xyz(lat, lon, 6)
            currentPositions.push([x, y, 0])
            newPositions.push([newX, newY, newZ])
        }
        name.value = 'globe'
        await transition(500, currentPositions, newPositions)
        rotateFlag = true
    }, 6000)

    animate()

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    })  
})

</script>

<template>
    <div>
        <h1>{{ name }}</h1>
        <div ref="mapContainer" class="map-container"> </div>
    </div>
</template>

<style scoped>
.map-container {
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle at center,  #1d133bff, #000000, #1d133bff, #000000);
}
h1 {
    position: absolute;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    z-index: 1;
    font-family: Arial, sans-serif;
    background-color: rgba(0, 0, 0, 0.7);
    padding: 5px 15px;
}
</style>