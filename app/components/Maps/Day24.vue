<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

const mapContainer = ref(null)

const createTexture = (renderer) => {
    const renderTargetScene = new THREE.Scene()
    const renderTargetCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const renderTargetGeometry = new THREE.PlaneGeometry(2, 2)
    const renderTargetMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec2 vUv;
            void main () {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            void main () {
                vec2 uv = (vUv - 0.5);
                float dist = length(uv);

                float col = step(dist, 0.5);
                gl_FragColor = vec4(col);
            }
        `
    })

    const renderTargetMesh = new THREE.Mesh(renderTargetGeometry, renderTargetMaterial)
    renderTargetScene.add(renderTargetMesh)

    const textureSize = 256
    const renderTarget = new THREE.WebGLRenderTarget(textureSize, textureSize, {
        minFilter: THREE.LinearFilter,
        maxFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat
    })

    renderer.setRenderTarget(renderTarget);
    renderer.render(renderTargetScene, renderTargetCamera)

    renderer.setRenderTarget(null)

    return renderTarget.texture
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
        group.rotation.y -= 0.003
        group.rotation.x -= 0.0003
        renderer.render(scene, camera)
    }

    const loadGeoJSON = async (url) => {
        const response = await fetch(url)
        const data = await response.json()
        return data
    }

    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.z = 2
    camera.position.y = 2
    camera.lookAt(new THREE.Vector3(0, 0, 0))

    const texture = createTexture(renderer)

    const geojson = await loadGeoJSON(`${baseUrl}/data/ne_110m_admin_0_countries.geojson`)
    geojson.features.forEach(feature => {
        const coordinates = feature.geometry.coordinates
        coordinates.forEach(polygon => {
            const outerRingLonLat = polygon[0]

            const linePoints3D = outerRingLonLat.map(([lon, lat]) => {
                const [x, y, z] = getPositionFromLatLon(lat, lon, 1.0)
                return new THREE.Vector3(x, y, z)
            })
            const lineGeometry3D = new THREE.BufferGeometry().setFromPoints(linePoints3D)
            const randomColor = 0xffffff;
            const lineMaterial3D = new THREE.LineBasicMaterial({ color: randomColor });
            const line3D = new THREE.Line(lineGeometry3D, lineMaterial3D)
            group.add(line3D);
        })
    })

    const vertices = []
    const pointGeojson = await loadGeoJSON(`${baseUrl}/data/day24/ne_110m_populated_places_simple.geojson`)
    pointGeojson.features.forEach(feature => {
        const [lon, lat] = feature.geometry.coordinates
        const [x, y, z] = getPositionFromLatLon(lat, lon, 1.001)
        vertices.push(x, y, z)
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    const material = new THREE.PointsMaterial(
        { 
            color: 0xffaa00, 
            size: 0.02,
            map: texture,
            alphaMap: texture,
        }
    )
    const points = new THREE.Points(geometry, material)
    group.add(points)

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