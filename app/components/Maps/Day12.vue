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
    const raycaster = new THREE.Raycaster();

    const ambientLight = new THREE.AmbientLight(0x999999, 2)
    scene.add(ambientLight)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 3, 5)
    scene.add(sunLight)

    const groundGeometry = new THREE.PlaneGeometry(1200, 1200);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0xccccff, depthWrite: false });
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

    const droneGltf = await gltfLoader.loadAsync(`${baseUrl}/data/day12/drone.glb`)
    const drone = droneGltf.scene.children[0];
    drone.scale.set(3, 3, 3);
    scene.add(drone)

    // 軌跡の点を格納する配列
    const trailPoints = []; 
    // 軌跡の最大点数（多すぎると重くなるので注意）
    const MAX_TRAIL_POINTS = 1000; 
    // 軌跡の更新頻度（例: 5フレームに1回）
    const TRAIL_UPDATE_INTERVAL = 5; 
    let trailUpdateTimer = 0;

    // 軌跡のジオメトリとマテリアル
    const trailGeometry = new THREE.BufferGeometry();
    // GLSLで色や太さを制御するなら THREE.ShaderMaterial が良いが、
    // ここでは手軽に光るような色と透明度を設定できる LineBasicMaterial で
    const trailMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,    // シアンで光るような色
        transparent: true,  // 透明度を有効にする
        opacity: 0.7,       // 開始時の透明度
        blending: THREE.AdditiveBlending // 加算合成で光る表現
    });
    const trailLine = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trailLine);

    camera.position.z = 0
    camera.position.y = 150
    camera.position.x = 200 
    camera.lookAt(0, 0, 0)

    drone.position.set(50, -70, 150);

    let stackCount = 0;
    let velocity = new THREE.Vector3(0, 0, 1);
    const clock = new THREE.Clock();
    const animate = function () {
        requestAnimationFrame(animate)
        const delta = clock.getDelta();
        gltf.scene.traverse( function ( child ) {
            if ( child.isMesh ) {
                const color = new THREE.Color().setHSL( ( hue % 360 ) / 360, 0.8, 0.4 );
                child.material.color = new THREE.Color(color);
                hue += 0.3;
            }
        } );
        // get drone direction
        raycaster.set(drone.position, velocity.clone().normalize());
        raycaster.far = 5.0;
        raycaster.near = 0.1;
        const intersects = raycaster.intersectObjects(scene.children, true);
        if(intersects.length > 1){
            //drone.material.color = new THREE.Color(0x00ff00);
            const intersect = intersects[0];
            // reflect the drone's direction based on the normal of the intersected surface
            const wallNormal = intersect.face.normal.clone();
            wallNormal.transformDirection( intersect.object.matrixWorld );
            wallNormal.y = 0;
            velocity.reflect(wallNormal);
            stackCount++;
        } else {
            //drone.material.color = new THREE.Color(0xff0000);
            stackCount--;
            if(stackCount < 0) stackCount = 0;
        }
        velocity.z -= Math.random() * 0.2; // simulate gravity
        velocity.x -= Math.random() * 0.3; // simulate gravity
        if(stackCount > 5){
            velocity.y += .01; // move up
        } else {
            velocity.y = 0;
        }
        const moveStep = velocity.clone().multiplyScalar(delta);
        drone.position.add(moveStep);
        if(drone.position.x > 600 || drone.position.x < -600){
            velocity.x -= 1;
        }
        if(drone.position.z > 600 || drone.position.z < -600){
            velocity.z -= 1;
        }

        trailUpdateTimer++;
        if (trailUpdateTimer >= TRAIL_UPDATE_INTERVAL) {
            trailUpdateTimer = 0;

            // ドローンの現在位置を軌跡の点に追加
            trailPoints.push(drone.position.x, drone.position.y, drone.position.z);

            // 点の数が最大を超えたら古い点を削除
            while (trailPoints.length / 3 > MAX_TRAIL_POINTS) {
                trailPoints.shift(); // x
                trailPoints.shift(); // y
                trailPoints.shift(); // z
            }

            // ジオメトリを更新
            trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trailPoints, 3));
        }
        renderer.render(scene, camera)
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