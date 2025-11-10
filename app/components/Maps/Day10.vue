<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const mapContainer = ref(null)
const tileTitle = ref('')
const size = 30

const latlon2xyz = (lat, lon, radius = 1) => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)

    const x = - (radius * Math.sin(phi) * Math.cos(theta))
    const z = (radius * Math.sin(phi) * Math.sin(theta))
    const y = (radius * Math.cos(phi))

    return [x, y, z]
}

const tileImages = [
    '4/13/5',
    '4/14/5',

    '4/13/6',
    '4/14/6',
]

const basemap = { 
    title: 'japan',
    url: tileImages.map((path) => {
        return `https://www.jma.go.jp/tile/gsi/pale/${path}.png`
    })
}
const tiles = [
    { 
        title: '11/10 23:20',
        url: tileImages.map((path) => {
            return `https://www.jma.go.jp/bosai/jmatile/data/nowc/20251110142000/none/20251110142000/surf/hrpns/${path}.png`
        })
    },
    { 
        title: '11/10 23:30',
        url: tileImages.map((path) => {
            return `https://www.jma.go.jp/bosai/jmatile/data/nowc/20251110143000/none/20251110143000/surf/hrpns/${path}.png`
        })
    },
    { 
        title: '11/10 23:40',
        url: tileImages.map((path) => {
            return `https://www.jma.go.jp/bosai/jmatile/data/nowc/20251110144000/none/20251110144000/surf/hrpns/${path}.png`
        })
    },
    { 
        title: '11/10 23:50',
        url: tileImages.map((path) => {
            return `https://www.jma.go.jp/bosai/jmatile/data/nowc/20251110145000/none/20251110145000/surf/hrpns/${path}.png`
        })
    },
    //{ 
    //    title: '1974-1978',
    //    url: tileImages.map((path) => {
    //        return `https://cyberjapandata.gsi.go.jp/xyz/gazo1/${path}.jpg`
    //    })
    //},
    //{ 
    //    title: '1979-1983',
    //    url: tileImages.map((path) => {
    //        return `https://cyberjapandata.gsi.go.jp/xyz/gazo2/${path}.jpg`
    //    })
    //},
    //{ 
    //    title: '1984-1986',
    //    url: tileImages.map((path) => {
    //        return `https://cyberjapandata.gsi.go.jp/xyz/gazo3/${path}.jpg`
    //    })
    //},
    //{ 
    //    title: '1987-1990',
    //    url: tileImages.map((path) => {
    //        return `https://cyberjapandata.gsi.go.jp/xyz/gazo4/${path}.jpg`
    //    })
    //},
    //{ 
    //    title: '2009',
    //    url: tileImages.map((path) => {
    //        return `https://cyberjapandata.gsi.go.jp/xyz/nendophoto2009/${path}.png`
    //    })
    //},
    //{ 
    //    title: '2014',
    //    url: tileImages.map((path) => {
    //        return `https://cyberjapandata.gsi.go.jp/xyz/nendophoto2014/${path}.png`
    //    })
    //},
    //{ 
    //    title: '2017',
    //    url: tileImages.map((path) => {
    //        return `https://cyberjapandata.gsi.go.jp/xyz/nendophoto2017/${path}.png`
    //    })
    //},
    //{ 
    //    title: '2019',
    //    url: tileImages.map((path) => {
    //        return `https://cyberjapandata.gsi.go.jp/xyz/nendophoto2019/${path}.png`
    //    })
    //},
]

const tileLatLon = tileImages.map((url) => {
    const parts = url.split('/')
    const z = parseInt(parts[1])
    const x = parseInt(parts[2])
    const y = parseInt(parts[3])

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
    const groundMaterial = new THREE.MeshBasicMaterial({ 
        map: new THREE.CanvasTexture(canvas),
        transparent: true
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
    const axesHelper = new THREE.AxesHelper( 5 );
    //scene.add( axesHelper );

    const group = new THREE.Group()
    scene.add(group)

    const basemapMesh = await createTileMesh(basemap.url)
    const basemapMaterial = basemapMesh.material
    const customMaterial = new THREE.ShaderMaterial({
        uniforms: {
            texture1: { value: basemapMaterial.map },
            darkness: { value: 0.7 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D texture1;
            uniform float darkness;
            varying vec2 vUv;
            void main() {
                vec4 texColor = texture2D(texture1, vUv);
                gl_FragColor = vec4(texColor.rgb * darkness, texColor.a);
            }
        `,
        transparent: true
    });
    group.add(new THREE.Mesh(basemapMesh.geometry, customMaterial))

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
    camera.position.y = -10
    camera.position.z = 25
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
    <h2>{{tileTitle}}</h2>
    <div ref="mapContainer" class="map-container">
    </div>
    <footer>Japan Meteororogical Agency</footer>
</template>

<style scoped>
h2 {
    position: absolute;
    top: 60px;
    left: 20px;
    color: white;
    z-index: 1;
    font-family: 'Arial', sans-serif;
    background-color: rgba(0, 0, 0, 0.5);
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
    background: radial-gradient(circle at center,  #1d133bff, #000000, #1d133bff, #000000);
}
</style>