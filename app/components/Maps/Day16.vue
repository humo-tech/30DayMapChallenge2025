<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

const mapContainer = ref(null)

const LAT_N = 90.0
const LAT_S = -90.0
const LON_W = -180.0
const LON_E = 180.0

const latlon2xy = (lat, lon) => {
    const ratio = (LON_E - LON_W) / (LAT_N - LAT_S)
    const x = ((lon - LON_W) / (LON_E - LON_W) - 0.5) * 2.0 * ratio
    const y = ((lat - LAT_S) / (LAT_N - LAT_S) - 0.5) * 2.0

    return [x, y]
}

const loadGeoJSON = async (url) => {
    const response = await fetch(url)
    const data = await response.json()
    return data
}


onMounted(async () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 100)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 1)
    renderer.shadowMap.enabled = true
    const controls = new OrbitControls(camera, renderer.domElement)
    const clock = new THREE.Clock()

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

    // make cell nuclei (like eyes)
    const eyeGeometry = new THREE.CircleGeometry(0.02, 64);
    // transform eyeGeometry as amebatic shape (BufferGeometry: mutate position attribute)
    {
        const pos = eyeGeometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const offset = (Math.sin(i*0.2) + Math.cos(i*0.1)) * 0.001; // Use a sin,cos function for smoother variation
            const x = pos.getX(i) + offset;
            const y = pos.getY(i) + offset;
            pos.setXY(i, x, y);
        }
        pos.needsUpdate = true;
        eyeGeometry.computeVertexNormals();
    }
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x9F6811 });
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.castShadow = true;
    eye.receiveShadow = true;
    const blackSphereGeometry = new THREE.CircleGeometry(0.005, 32);
    const blackSphereMaterial = new THREE.MeshPhongMaterial({ color: 0x9F9F17 });
    const blackSphere = new THREE.Mesh(blackSphereGeometry, blackSphereMaterial);
    blackSphere.position.set(0.002, 0, 0.005);
    //blackSphere.rotation.x = Math.PI / 2;
    eye.add(blackSphere);


    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.y = -1
    camera.position.z = 1
    camera.lookAt(new THREE.Vector3(0, 0, 0))

    const geojson = await loadGeoJSON(`${baseUrl}/data/ne_110m_admin_0_countries.geojson`)
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

            // Extrude the shape to give thickness
            const depth = 0.03
            const extrudeSettings = {
                depth: depth,
                bevelEnabled: false,
                curveSegments: 8,
                steps: 1
            }
            const polygonGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)

            // Convert geometry's lon/lat (x=lon, y=lat) to projected x,y while keeping z (thickness)
            const positions = polygonGeometry.attributes.position
            const flatPositions = []
            for (let i = 0; i < positions.count; i++) {
                const lon = positions.getX(i)
                const lat = positions.getY(i)
                const z = positions.getZ(i) // 0 .. depth
                const [x, y] = latlon2xy(lat, lon)
                flatPositions.push(x, y, z)
            }
            polygonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flatPositions, 3))
            polygonGeometry.computeVertexNormals()

            const polygonMaterial = new THREE.MeshPhongMaterial({ 
                color: 0xD1E9C0,
                side: THREE.DoubleSide,
            })
            const polygonMesh = new THREE.Mesh(polygonGeometry, polygonMaterial)
            group.add(polygonMesh);

            // top outline (slightly above top face)
            const topZ = depth + 0.001
            const linePoints3D = outerRingLonLat.map(([lon, lat]) => {
                const [x, y] = latlon2xy(lat, lon)
                return new THREE.Vector3(x, y, topZ)
            })
            const lineGeometry3D = new THREE.BufferGeometry().setFromPoints(linePoints3D)
            const lineMaterial3D = new THREE.LineBasicMaterial({ color: 0x11491c });
            const line3D = new THREE.Line(lineGeometry3D, lineMaterial3D)
            group.add(line3D);

            // put eye marker
            const polygonGravity = outerRingLonLat.reduce((acc, coord) => {
                acc[0] += coord[0]
                acc[1] += coord[1]
                return acc
            }, [0,0]).map(v => v / outerRingLonLat.length)
            const polygonCenterXY = latlon2xy(polygonGravity[1], polygonGravity[0])

            const polygonSize = outerRingLonLat.length

            const eyeClone = eye.clone()
            eyeClone.position.set(polygonCenterXY[0], polygonCenterXY[1], depth + 0.002)
            const size = Math.min(polygonSize * 0.007, 1);
            eyeClone.scale.setScalar(size)
            eyeClone.rotation.z = Math.random()
            scene.add(eyeClone)

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
    <div ref="mapContainer" class="map-container"></div>
</template>

<style scoped>
.map-container {
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle at center, #0b0812, #4d2c57, #231818, #000000)
}
.info {
    font-family: sans-serif;
    position: absolute;
    top: 90px;
    left: 80px;
    color: white;
}
.date {
    font-size: 32px;
}
ul {
    margin: 4px;
    list-style-type: none;
    font-size: 18px;
}
</style>