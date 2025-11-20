<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

const mapContainer = ref(null)

onMounted(() => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
    const controls = new OrbitControls(camera, renderer.domElement)

    const group = new THREE.Group()
    scene.add(group)

    const geometry = new THREE.SphereGeometry(1, 32, 32)
    const textureLoader = new THREE.TextureLoader()
    const material = new THREE.MeshPhongMaterial({
        map: textureLoader.load(`${baseUrl}/images/maps/day01/GRAY_50M_SR_OB.jpg`),
        specular: new THREE.Color('grey')
    })

    const earth = new THREE.Mesh(geometry, material)
    group.add(earth)

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

    loadGeoJSON(`${baseUrl}/data/ne_110m_admin_0_countries.geojson`).then(geojson => {
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

        geojson.features.forEach(feature => {
            const coordinates = feature.geometry.coordinates
            coordinates.forEach(polygon => {
                const outerRingLonLat = polygon[0]
                const shapePoints = createContinuousPoints(outerRingLonLat);
                const shape = new THREE.Shape(shapePoints)

                if (polygon.length > 1) {
                    for (let i = 1; i < polygon.length; i++) {
                        const holeLonLat = polygon[i];
                        const holePoints = createContinuousPoints(holeLonLat);
                        const holePath = new THREE.Path(holePoints);
                        shape.holes.push(holePath);
                    }
                }

                const polygonGeometry = new THREE.ShapeGeometry(shape)

                const positions = polygonGeometry.attributes.position
                const sphericalPositions = []
                for(let i = 0; i < positions.count; i++) {
                    const lon = positions.getX(i)
                    const lat = positions.getY(i)
                    const [x, y, z] = getPositionFromLatLon(lat, lon, 1.0)
                    sphericalPositions.push(x, y, z)
                }
                polygonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sphericalPositions, 3))

                polygonGeometry.computeVertexNormals()

                const polygonMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color("hsl(" + (outerRingLonLat.length % 360) + ", 90%, 60%)"), side: THREE.FrontSide })
                const polygonMesh = new THREE.Mesh(polygonGeometry, polygonMaterial)
                group.add(polygonMesh);

                const linePoints3D = outerRingLonLat.map(([lon, lat]) => {
                    const [x, y, z] = getPositionFromLatLon(lat, lon, 1.0)
                    return new THREE.Vector3(x, y, z)
                })
                const lineGeometry3D = new THREE.BufferGeometry().setFromPoints(linePoints3D)
                const lineMaterial3D = new THREE.LineBasicMaterial({ color: 0x000000 })
                const line3D = new THREE.Line(lineGeometry3D, lineMaterial3D)
                group.add(line3D);
            })
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
    background: radial-gradient(circle at center,  #1d133bff, #000000, #1d133bff, #000000);
}
</style>
