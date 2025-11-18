<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

const mapContainer = ref(null)

let currentIndex = 0;
const images = [
    {img: '2k_sun.jpg', flareColor: 0xffffff, desc: 'Day Map'},
    {img: '2k_mercury.jpg', flareColor: 0xffffff, desc: 'Day Map'},
    {img: '2k_venus_surface.jpg', flareColor: 0xffffff, desc: 'Day Map'},
    {img: '2k_earth_daymap.jpg', flareColor: 0xffffff, desc: 'Day Map'},
    {img: '2k_moon.jpg', flareColor: 0xffffff, desc: 'Day Map'},
    {img: '2k_mars.jpg', flareColor: 0xffffff, desc: 'Day Map'},
    {img: '2k_jupiter.jpg', flareColor: 0xffffff, desc: 'Day Map'},
    {img: '2k_saturn.jpg', flareColor: 0xffffff, desc: 'Day Map'},
    {img: '2k_uranus.jpg', flareColor: 0xffffff, desc: 'Day Map'},
    {img: '2k_neptune.jpg', flareColor: 0xffffff, desc: 'Day Map'},
]
onMounted(async () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer()
    const controls = new OrbitControls(camera, renderer.domElement)
    const geometry = new THREE.SphereGeometry(1, 32, 32)
    const textureLoader = new THREE.TextureLoader()
    const mainTexture = await textureLoader.load(`${baseUrl}/images/maps/day18/${images[currentIndex].img}`)
    const subTexture = await textureLoader.load(`${baseUrl}/images/maps/day18/${images[(currentIndex + 1) % images.length].img}`)

    const material = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D texture1;
            uniform sampler2D texture2;
            uniform float mixRatio;
            varying vec2 vUv;
            void main() {
                vec4 color1 = texture2D(texture1, vUv);
                vec4 color2 = texture2D(texture2, vUv);
                gl_FragColor = mix(color1, color2, mixRatio);
            }
        `,
        uniforms: {
            texture1: { value: mainTexture },
            texture2: { value: subTexture },
            mixRatio: { value: 0.0 }
        }
    })

    const group = new THREE.Group()
    scene.add(group)

    const earth = new THREE.Mesh(geometry, material)
    group.add(earth)

    const ambientLight = new THREE.AmbientLight(0x666677, 2)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 7, 5)
    scene.add(sunLight)

    const animate = function () {
        requestAnimationFrame(animate)
        group.rotation.y += 0.009
        if(group.rotation.y > Math.PI * 2) {
            console.log('switch texture')
            if(material.uniforms.mixRatio.value < 1.0) {
                material.uniforms.mixRatio.value += 0.01
            } else {
                // 切り替え完了後、次のテクスチャに更新
                // texture2の内容をtexture1にコピー
                material.uniforms.texture1.value = material.uniforms.texture2.value
                
                // 次のテクスチャをtexture2に読み込む
                currentIndex = (currentIndex + 1) % images.length
                const nextIndex = (currentIndex + 1) % images.length
                console.log('update texture ' + currentIndex + ': ' + images[currentIndex].img)
                material.uniforms.texture2.value = textureLoader.load(`${baseUrl}/images/maps/day18/${images[nextIndex].img}`)
                
                material.uniforms.mixRatio.value = 0.0
                group.rotation.y -= Math.PI * 2
            }   
        }
        renderer.render(scene, camera)
    }

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