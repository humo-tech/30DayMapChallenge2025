<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

const mapContainer = ref(null)

const LAT_N = 50.0
const LAT_S = 20.0
const LON_W = 120.0
const LON_E = 150.0

const latlon2xy = (lat, lon) => {
    const x = ((lon - LON_W) / (LON_E - LON_W) - 0.5) * 2.0
    const y = ((lat - LAT_S) / (LAT_N - LAT_S) - 0.5) * 2.0

    return [x, y]
}

onMounted(async () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
    renderer.shadowMap.enabled = true
    const controls = new OrbitControls(camera, renderer.domElement)

    const group = new THREE.Group()
    scene.add(group)

    const ambientLight = new THREE.AmbientLight(0x666677, 2)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 3, 5)
    scene.add(sunLight)

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
    camera.position.y = -0.5
    camera.position.z = 1
    camera.lookAt(new THREE.Vector3(0, 0, 0))

    const geojson = await loadGeoJSON(`${baseUrl}/data/ne_10m_admin_0_japan.geojson`)
    geojson.features.forEach(feature => {
        const coordinates = feature.geometry.coordinates
        coordinates.forEach(polygon => {
            const outerRingLonLat = polygon[0]
            const shapePoints = createContinuousPoints(outerRingLonLat).map(point => new THREE.Vector2(...point));
            const shape = new THREE.Shape(shapePoints)

            if (polygon.length > 1) {
                for (let i = 1; i < polygon.length; i++) {
                    const holeLonLat = polygon[i];
                    const holePoints = createContinuousPoints(holeLonLat).map(point => new THREE.Vector2(...point))
                    const holePath = new THREE.Path(holePoints);
                    shape.holes.push(holePath);
                }
            }

            const polygonGeometry = new THREE.ShapeGeometry(shape)

            const positions = polygonGeometry.attributes.position
            const flatPositions = []
            for(let i = 0; i < positions.count; i++) {
                const lon = positions.getX(i)
                const lat = positions.getY(i)
                const [x, y] = latlon2xy(lat, lon)
                flatPositions.push(x, y, 0.0)
            }
            polygonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flatPositions, 3))

            polygonGeometry.computeVertexNormals()

            const polygonMaterial = new THREE.MeshBasicMaterial({ color: 0x061030, side: THREE.FrontSide })
            const polygonMesh = new THREE.Mesh(polygonGeometry, polygonMaterial)
            group.add(polygonMesh);


            const linePoints3D = outerRingLonLat.map(([lon, lat]) => {
                const [x, y] = latlon2xy(lat, lon)
                return new THREE.Vector3(x, y, 0)
            })
            const lineGeometry3D = new THREE.BufferGeometry().setFromPoints(linePoints3D)
            const lineMaterial3D = new THREE.LineBasicMaterial({ color: 0x003366 });
            const line3D = new THREE.Line(lineGeometry3D, lineMaterial3D)
            group.add(line3D);
        })
    })

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
    background: radial-gradient(circle at center, #0b0812, #4d2c57, #231818, #000000)
}
</style>