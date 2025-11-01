<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const mapContainer = ref(null)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer()
const controls = new OrbitControls(camera, renderer.domElement)
const geometry = new THREE.SphereGeometry(1, 32, 32)
const textureLoader = new THREE.TextureLoader()
const material = new THREE.MeshPhongMaterial({
    map: textureLoader.load('/images/maps/day01/GRAY_50M_SR_OB.jpg'),
    specular: new THREE.Color('grey')
})

const group = new THREE.Group()
scene.add(group)

const earth = new THREE.Mesh(geometry, material)
group.add(earth)

const tokyo = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
)
const lat = 35.6895 * (Math.PI / 180)
const lon = (139.6917+80) * (Math.PI / 180) // shifted 80 degrees for better view(why?)
const radius = 1
tokyo.position.set(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.sin(lon)
)
group.add(tokyo)

const ambientLight = new THREE.AmbientLight(0x666677, 2)
scene.add(ambientLight)

const sunLight = new THREE.DirectionalLight(0xffffff, 1)
sunLight.position.set(5, 3, 5)
scene.add(sunLight)

const atmosphereGeometry = new THREE.SphereGeometry(1.1, 64, 64);
const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        void main() {
            float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            gl_FragColor = vec4(0.3, 0.3, 0.7, 1.0) * intensity;
        }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
});
const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
scene.add(atmosphere);

const animate = function () {
    requestAnimationFrame(animate)
    group.rotation.y += 0.003
    renderer.render(scene, camera)
}

onMounted(() => {
    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.z = 3

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
    background-color: #001;
}
</style>