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

const weekOffset = 25
const fireworkDate = ref("")
const targetFireworks = ref([])

const latlon2xy = (lat, lon) => {
    const x = ((lon - LON_W) / (LON_E - LON_W) - 0.5) * 2.0
    const y = ((lat - LAT_S) / (LAT_N - LAT_S) - 0.5) * 2.0

    return [x, y]
}

class Firework {
    constructor(renderer, position = new THREE.Vector3(0, 10, 0), {numParticles = 2000, scale = 0.001, color = 0xff0000} = {}) {
        this.renderer = renderer
        this.position = position
        this.scale = scale
        this.numParticles = numParticles
        this.color = color

        this.velocities = new Array(this.numParticles)
        this.exploding = true
        this.vertices = []
        this.velocities = []
        this.opacity = 1.0
        this.gravity = 0.0002 * this.scale

        this.mesh = this.#initMesh()
    }

    #createTexture () {
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

                    float brightness = 0.05;
                    float col = brightness / dist * 0.9;
                    if (col < 0.1) {
                        discard;
                    }
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

        this.renderer.setRenderTarget(renderTarget);
        this.renderer.render(renderTargetScene, renderTargetCamera)

        this.renderer.setRenderTarget(null)

        return renderTarget.texture
    }

    #initMesh () {
        for(let i=0; i<this.numParticles; i++ ) {
            const x = this.position.x
            const y = this.position.y * this.scale
            const z = this.position.z
            this.vertices.push(x, y, z)

            const elevationAngle = Math.random() * Math.PI * 2
            const azimuthAngle = Math.random() * Math.PI * 2

            const distance = (Math.random() - 0.5) * 2.0 * this.scale * 0.05 
            this.velocities[i] = new THREE.Vector3(
                Math.cos(elevationAngle) * Math.cos(azimuthAngle) * distance,
                Math.sin(elevationAngle) * distance,
                Math.cos(elevationAngle) * Math.sin(azimuthAngle) * distance,
            )
        }
        this.originarVertices = [...this.vertices]
        const geometry = new THREE.BufferGeometry() 
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.vertices, 3))

        const texture = this.#createTexture()
        const material = new THREE.PointsMaterial({
            size: 0.01,
            color: this.color,
            transparent: true,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            map: texture
        })

        return new THREE.Points(geometry, material)
    }

    addTo = (scene) => {
        scene.add(this.mesh)
        console.log(this.mesh.userData.name)
    }

    animate = () => {
        if(!this.exploding) return

        for(let i=0; i<this.numParticles; i++) {
            const offset = i * 3
            this.vertices[offset + 0] += this.velocities[i].x
            this.vertices[offset + 1] += this.velocities[i].y
            this.vertices[offset + 2] += this.velocities[i].z
            this.velocities[i].y -= this.gravity
        }
        this.mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.vertices, 3))
        this.opacity -= 0.004
        this.mesh.material.opacity = this.opacity
        this.exploding = this.opacity > 0
        requestAnimationFrame(this.animate)
    }

}

const loadFireworksList = async () => {
    const text = await fetch(`${baseUrl}data/day15/fireworks2025.tsv`).then(res => res.text())
    return text.split(/[\r\n]/).filter(line => !!line).map(line => {
        const [dateTxt, date, weekNumber, name, place, lat, lon] = line.split(/\t/)
        const data = { weekNumber: Number(weekNumber) - weekOffset, lat: Number(lat), lon: Number(lon), date, name }
        return data
    })
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
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
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
    let preElapsedSec = -1;

    const animate = function () {
        requestAnimationFrame(animate)
        const elapsedSec = Math.floor(clock.getElapsedTime())
        if(preElapsedSec !== elapsedSec) {
            targetFireworks.value = fireworkObjects.filter(firework => firework.mesh.userData.weekNumber === elapsedSec)
            targetFireworks.value.forEach(firework => {
                firework.addTo(group)
                firework.animate()
            })
            if(targetFireworks.value.length) {
                fireworkDate.value = targetFireworks.value[0].mesh.userData.date + '〜'
            } else {
                fireworkDate.value = ''
            }
        }
        preElapsedSec = elapsedSec

        renderer.render(scene, camera)
    }

    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.y = -0.5
    camera.position.z = 1
    camera.lookAt(new THREE.Vector3(0, 0, 0))

    const fireworksList = await loadFireworksList()
    const fireworkObjects = []
    //const firework = new Firework(renderer, new THREE.Vector3(0, 10, 0), {color: 0xff0000, scale: 0.01})
    //group.add(firework.mesh)
    fireworksList.forEach(fireworkInfo => {
        const [x, y] = latlon2xy(fireworkInfo.lat, fireworkInfo.lon)
        const fireworkPosition = new THREE.Vector3(0, 10, 0)
        const fireworkColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.5)
        const firework = new Firework(renderer, fireworkPosition, {color: fireworkColor, scale: 0.01})
        firework.mesh.position.x = x
        firework.mesh.position.y = y
        firework.mesh.userData = {...fireworkInfo}
        fireworkObjects.push(firework)
    })

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
    <div ref="mapContainer" class="map-container"></div>
    <div class="info">
        <div class="date">{{fireworkDate}}</div>
        <ul>
            <li v-for="firework in targetFireworks">{{firework.mesh.userData.name}}</li>
        </ul>
    </div>    
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