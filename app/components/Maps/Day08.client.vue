<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''
const mapContainer = ref(null)
const gltfLoader = new GLTFLoader()
let hue = 0;

onMounted(async () => {
    const scene = new THREE.Scene()

    const ambientLight = new THREE.AmbientLight(0x999999, 2)
    scene.add(ambientLight)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 3, 5)
    scene.add(sunLight)

    const groundGeometry = new THREE.PlaneGeometry(1200, 1200);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, depthWrite: false });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = - Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
    const controls = new OrbitControls(camera, renderer.domElement)
    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(mapContainer.value.clientWidth, mapContainer.value.clientHeight)

    const gltf = await gltfLoader.loadAsync(`${baseUrl}/data/day08/bldg_Building.glb`)
    scene.add(gltf.scene)

    camera.position.z = 50
    camera.position.y = 50
    camera.position.x = 50
    camera.lookAt(0, 20, 20)

    const animate = function () {
        requestAnimationFrame(animate)
        gltf.scene.traverse( function ( child ) {
            if ( child.isMesh ) {
                const color = new THREE.Color().setHSL( ( hue % 360 ) / 360, 0.8, 0.4 );
                child.material.color = new THREE.Color(color);
                hue += 0.3;
            }
        } );
        renderer.render(scene, camera)
        scene.rotation.y += 0.002
    }
    animate()

    window.addEventListener('resize', () => {
        camera.aspect = mapContainer.value.clientWidth /  mapContainer.value.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(mapContainer.value.clientWidth, mapContainer.value.clientHeight)
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
    background: radial-gradient(circle at center,  #1d133bff, #000000, #1d133bff, #000000);
}
</style>