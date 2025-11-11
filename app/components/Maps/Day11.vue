<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

const mapContainer = ref(null)

const clock = new THREE.Clock();

onMounted(() => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer()
    const controls = new OrbitControls(camera, renderer.domElement)
    const geometry = new THREE.SphereGeometry(1, 32, 32)
    const textureLoader = new THREE.TextureLoader()
    //const material = new THREE.MeshPhongMaterial({
    //    map: textureLoader.load(`${baseUrl}images/maps/day11/NE2_50M_SR_W.jpg`),
    //    specular: new THREE.Color('grey')
    //})
    const material = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform float time;
            uniform sampler2D texture1;
            void main() {
                vec4 texColor = texture2D(texture1, vUv.xy);
                float lum = dot(texColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                vec3 gray = vec3(lum);

                float period = 6.0;

                float t = mod(time, period);
                float mixFactor = 0.0;
                float quarterPeriod = period * 0.25;

                if (t < quarterPeriod) {
                    float ratio = t / quarterPeriod;
                    mixFactor = 1.0 - pow(1.0 - ratio, 2.0);
                } else if (t >= quarterPeriod && t < period - quarterPeriod) {
                    mixFactor = 1.0;
                } else {
                    float ratio = (t - (period - quarterPeriod)) / quarterPeriod;
                    mixFactor = pow(1.0 - ratio, 2.0);
                }
                vec3 finalColor = mix(texColor.rgb, gray, mixFactor);
                gl_FragColor = vec4(finalColor, 1.0);

                //gl_FragColor = vec4(vec3(cos(time)), 1.0);
            }
        `,
        uniforms: {
            texture1: { value: textureLoader.load(`${baseUrl}images/maps/day11/NE2_50M_SR_W.jpg`) },
            time: { value: clock.getElapsedTime() }
        }
    });

    const group = new THREE.Group()
    scene.add(group)

    const earth = new THREE.Mesh(geometry, material)
    group.add(earth)


    const ambientLight = new THREE.AmbientLight(0x666677, 2)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 5, 3)
    scene.add(sunLight)

    const animate = function () {
        requestAnimationFrame(animate)
        group.rotation.y += 0.002
        material.uniforms.time.value = clock.getElapsedTime();
        renderer.render(scene, camera)
    }

    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.z = 2

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
    <footer>Natural Earth</footer>
</template>

<style scoped>
.map-container {
    width: 100vw;
    height: 100vh;
    background-color: #001;
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
</style>