<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const mapContainer = ref(null)
const tileTitle = ref('')
const size = 30

function createBicycle() {
    const bikeGroup = new THREE.Group();

    // 共通マテリアル（色）
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff00, roughness: 0.4 }); // 
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }); // 黒いタイヤ
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.5 }); // 金属部分

    // 1. タイヤ (前輪・後輪)
    const wheelGeo = new THREE.TorusGeometry(0.6, 0.08, 16, 32);
    const wheelFront = new THREE.Mesh(wheelGeo, tireMat);
    wheelFront.position.set(1.0, 0.6, 0);
    
    const wheelBack = new THREE.Mesh(wheelGeo, tireMat);
    wheelBack.position.set(-0.9, 0.6, 0);

    bikeGroup.add(wheelFront, wheelBack);

    // 2. フレーム (三角形をつなぐイメージ)
    // メインフレーム
    const frameGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2);
    const mainTube = new THREE.Mesh(frameGeo, frameMat);
    mainTube.rotation.z = Math.PI / 2; // 横向き
    mainTube.position.set(0.2, 1.4, 0); // タイヤの軸の高さ
    
    // サドル支柱（シートポスト）方向
    const seatPostGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.3);
    const seatTube = new THREE.Mesh(seatPostGeo, frameMat);
    seatTube.position.set(-0.25, 1., 0);
    seatTube.rotation.z = 0.3;

    const seatPostGeo2 = new THREE.CylinderGeometry(0.05, 0.05, 1.);
    const seatTube2 = new THREE.Mesh(seatPostGeo2, frameMat);
    seatTube2.position.set(-0.6, 1., 0);
    seatTube2.rotation.z = -0.6;
  
          const seatPostGeo3 = new THREE.CylinderGeometry(0.05, 0.05, 0.8);
    const seatTube3 = new THREE.Mesh(seatPostGeo3, frameMat);
    seatTube3.position.set(-0.5, 0.5, 0);
    seatTube3.rotation.z = 1.4;
    // ハンドル支柱方向
    const handlePostGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.9);
    const handleTube = new THREE.Mesh(handlePostGeo, frameMat);
    handleTube.position.set(0.8, 1.2, 0);
    handleTube.rotation.z = 0.3;
    // ハンドル支柱方向

    const handlePostGeo2 = new THREE.CylinderGeometry(0.05, 0.05, 1.2);
    const handleTube2 = new THREE.Mesh(handlePostGeo2, frameMat);
    handleTube2.position.set(0.3, 0.9, 0);
    handleTube2.rotation.z = -0.7;
    // フレームをグループに追加
    bikeGroup.add(mainTube, seatTube, handleTube, handleTube2, seatTube2, seatTube3);

    // 3. ハンドルバー
    const handleBarGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8);
    const handleBar = new THREE.Mesh(handleBarGeo, metalMat);
    handleBar.rotation.x = Math.PI / 2; // 横棒にする
    handleBar.position.set(0.75, 1.6, 0); // ハンドル支柱の先
    bikeGroup.add(handleBar);

    // 4. サドル
    const seatGeo = new THREE.BoxGeometry(0.4, 0.1, 0.3);
    const seat = new THREE.Mesh(seatGeo, tireMat);
    seat.position.set(-0.4, 1.6, 0); // シートポストの先
    bikeGroup.add(seat);

    return bikeGroup;
}

const tileImages = [
    '14/14550/6450',
    '14/14551/6450',
    '14/14552/6450',
    '14/14553/6450',

    '14/14550/6451',
    '14/14551/6451',
    '14/14552/6451',
    '14/14553/6451',

    '14/14550/6452',
    '14/14551/6452',
    '14/14552/6452',
    '14/14553/6452',

    '14/14550/6453',
    '14/14551/6453',
    '14/14552/6453',
    '14/14553/6453',
]

const tiles = [
    { 
        title: '2019',
        url: tileImages.map((path) => {
            return `https://cyberjapandata.gsi.go.jp/xyz/nendophoto2019/${path}.png`
        })
    },
]

const tileLatLon = tileImages.map((url) => {
    const parts = url.split('/')
    const z = parseInt(parts[0])
    const x = parseInt(parts[1])
    const y = parseInt(parts[2])

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
console.log(leftTopLat, leftTopLon, rightBottomLat, rightBottomLon)

const leftTopX = mercatorX(leftTopLon)
const leftTopY = mercatorY(leftTopLat)
const rightBottomX = mercatorX(rightBottomLon)
const rightBottomY = mercatorY(rightBottomLat)

const createTileMesh = async (tileImageList) => {
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

    const groundGeometry = new THREE.PlaneGeometry(size, size)
    const sideNumber = Math.sqrt(tileImageList.length)

    const canvas = document.createElement('canvas')
    canvas.width = 256 * sideNumber
    canvas.height = 256 * sideNumber
    const context = canvas.getContext('2d')
    const images = await loadImages(tileImageList)
    images.forEach((image, index) => {
        const x = (index % sideNumber) * 256
        const y = Math.floor(index / sideNumber) * 256
        context.drawImage(image, x, y, 256, 256)
    })

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = 'srgb'
    const groundMaterial = new THREE.MeshBasicMaterial({ 
        map: texture
     })

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

onMounted(async () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
    const controls = new OrbitControls(camera, renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xf5f5f5, 2)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 5, 5)
    scene.add(sunLight)


    const group = new THREE.Group()
    scene.add(group)

    const tileMeshes = await Promise.all(tiles.map(tile => {
        return createTileMesh(tile.url)
    }))
    tileMeshes.forEach(mesh => {
        mesh.visible = false
        group.add(mesh)
    })

    let currentTileIndex = 0
    setInterval(() => {
        tileMeshes.forEach((mesh, index) => {
            mesh.visible = (index === currentTileIndex)
        })
        tileTitle.value = tiles[currentTileIndex].title
        currentTileIndex = (currentTileIndex + 1) % tileMeshes.length
    }, 1000)

    const animate = function () {
        requestAnimationFrame(animate)
        //group.rotation.z += 0.0001
        renderer.render(scene, camera)
    }

    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.x = 0 
    camera.position.y = -17
    camera.position.z = 16
    camera.lookAt(new THREE.Vector3(0, 0, -5))

    const stations = await fetch('/data/day21/hellocycling_tokyo.csv').then(res => res.text())
    .then(text => {
        const lines = text.split('\n')
        return lines.filter(line => line.trim() !== '').slice(1).map(line => {
            const parts = line.split(',').map(part => part.replace(/"/g, '').trim())
            return {
                lat: parseFloat(parts[0]),
                lon: parseFloat(parts[1]),
                capacity: parseInt(parts[2]),
            }
        })
    })

    const bike = createBicycle()
    for (const station of stations) {
        const x = ((mercatorX(station.lon) - leftTopX) / (rightBottomX - leftTopX) - 0.5) * size
        const y = -((mercatorY(station.lat) - leftTopY) / (rightBottomY - leftTopY) - 0.5) * size
        if(x < -size/2 || x > size/2 || y < -size/2 || y > size/2) {
            continue
        }
        const bikeClone = bike.clone()
        bikeClone.rotation.x = Math.PI / 2
        bikeClone.position.set(x, y, 0)
        const scale = 0.5 + station.capacity / 100
        bikeClone.scale.set(scale, scale, scale)
        group.add(bikeClone)
    }

    animate()

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    })  
})

</script>

<template>
    <h2>HELLO CYCLING (Shared Bike Stations)</h2>
    <div ref="mapContainer" class="map-container">
    </div>
    <footer>Japan Geographical Survey Institute Tile</footer>
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