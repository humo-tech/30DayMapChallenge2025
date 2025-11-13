<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

const mapContainer = ref(null)
const bloomParams = {
  exposure: 0.7, // トーンマッピング: 露光量
  bloomStrength: 6.0, // 発光エフェクト: 強さ
  bloomRadius: 0.5, // 発光エフェクト: 半径
  bloomThreshold: 0, // 発光エフェクト: 閾値
};


onMounted(() => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
    renderer.shadowMap.enabled = true
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = Math.pow(bloomParams.exposure, 4.0);
    const controls = new OrbitControls(camera, renderer.domElement)

    const renderPass = new RenderPass(scene, camera);

    // エフェクト: 発光エフェクト
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        bloomParams.bloomStrength,
        bloomParams.bloomRadius,
        bloomParams.bloomThreshold,
    );

    // エフェクトのセットアップ
    const effectComposer = new EffectComposer(renderer);
    effectComposer.addPass(renderPass);
    effectComposer.addPass(bloomPass);
    effectComposer.setSize(window.innerWidth, window.innerHeight);


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
        //renderer.render(scene, camera)
        effectComposer.render()
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

                const linePoints3D = outerRingLonLat.map(([lon, lat]) => {
                    const [x, y, z] = getPositionFromLatLon(lat, lon, 1.0)
                    return new THREE.Vector3(x, y, z)
                })
                const lineGeometry3D = new THREE.BufferGeometry().setFromPoints(linePoints3D)
                const randomColor = Math.random() * 0xffffff;
                const lineMaterial3D = new THREE.LineBasicMaterial({ color: randomColor });
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