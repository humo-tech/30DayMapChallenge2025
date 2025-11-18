<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

const mapContainer = ref(null)
const name = ref('Sun')

let currentIndex = 0;
const images = [
    {img: '2k_sun.jpg', flareColor: 0xffff00, desc: 'Sun'},
    {img: '2k_mercury.jpg', flareColor: 0xaaaaaa, desc: 'Mercury'},
    {img: '2k_venus_surface.jpg', flareColor: 0xffcc00, desc: 'Venus'},
    {img: '2k_earth_daymap.jpg', flareColor: 0x0000ff, desc: 'Earth'},
    {img: '2k_moon.jpg', flareColor: 0x888888, desc: 'Moon'},
    {img: '2k_mars.jpg', flareColor: 0xff0000, desc: 'Mars'},
    {img: '2k_jupiter.jpg', flareColor: 0xffa500, desc: 'Jupiter'},
    {img: '2k_saturn.jpg', flareColor: 0xffd700, desc: 'Saturn'},
    {img: '2k_uranus.jpg', flareColor: 0x00ffff, desc: 'Uranus'},
    {img: '2k_neptune.jpg', flareColor: 0x0000ff, desc: 'Neptune'},
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
                //gl_FragColor = vec4(0.0);
            }
        `,
        uniforms: {
            texture1: { value: mainTexture },
            texture2: { value: subTexture },
            mixRatio: { value: 0.0 }
        }
    })

    const group = new THREE.Group()
    // 地球の自転軸の傾き (23.4度)
    group.rotation.x = 23.4 * Math.PI / 180
    scene.add(group)

    const earth = new THREE.Mesh(geometry, material)
    group.add(earth)

    const ambientLight = new THREE.AmbientLight(0x666677, 2)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 7, 5)
    scene.add(sunLight)

    const atmosphereGeometry = new THREE.SphereGeometry(1.1, 36, 36);
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
            uniform vec4 flareColor1;
            uniform vec4 flareColor2;
            uniform float mixRatio;
            void main() {
                float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = mix(flareColor1, flareColor2, mixRatio) * intensity;
            }
        `,
        uniforms: {
            flareColor1: { value: (() => {
                const color = new THREE.Color(images[currentIndex].flareColor)
                return new THREE.Vector4(color.r, color.g, color.b, 1.0)
            })() },
            flareColor2: { value: (() => {
                const color = new THREE.Color(images[(currentIndex + 1) % images.length].flareColor)
                return new THREE.Vector4(color.r, color.g, color.b, 1.0)
            })() },
            mixRatio: { value: 0.0 }
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    const animate = function () {
        requestAnimationFrame(animate)
        group.rotation.y += 0.009
        if(group.rotation.y > Math.PI * 2) {
            if(material.uniforms.mixRatio.value < 1.0) {
                material.uniforms.mixRatio.value += 0.01
                atmosphereMaterial.uniforms.mixRatio.value += 0.01
                if(material.uniforms.mixRatio.value > 0.7) {
                    name.value = images[(currentIndex + 1) % images.length].desc
                }
            } else {
                // 切り替え完了後、次のテクスチャに更新
                // texture2の内容をtexture1にコピー
                material.uniforms.texture1.value = material.uniforms.texture2.value
                
                // 次のテクスチャをtexture2に読み込む
                currentIndex = (currentIndex + 1) % images.length
                const nextIndex = (currentIndex + 1) % images.length
                material.uniforms.texture2.value = textureLoader.load(`${baseUrl}/images/maps/day18/${images[nextIndex].img}`)
                const newColor = new THREE.Color(images[currentIndex].flareColor)
                atmosphereMaterial.uniforms.flareColor1.value = new THREE.Vector4(newColor.r, newColor.g, newColor.b, 1.0)
                const newColor2 = new THREE.Color(images[nextIndex].flareColor)
                atmosphereMaterial.uniforms.flareColor2.value = new THREE.Vector4(newColor2.r, newColor2.g, newColor2.b, 1.0)
                
                material.uniforms.mixRatio.value = 0.0
                atmosphereMaterial.uniforms.mixRatio.value = 0.0
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
    <div>
        <h1>{{ name }}</h1>
        <div ref="mapContainer" class="map-container"> </div>
    </div>
    <footer>https://www.solarsystemscope.com/</footer>
</template>

<style scoped>
h1 {
    position: absolute;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    z-index: 1;
    font-family: Arial, sans-serif;
}
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