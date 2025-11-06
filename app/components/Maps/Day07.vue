<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const mapContainer = ref(null)
const selectedCountry = ref(null);
const showModal = ref(true);


onMounted(() => {
    let mouseMoving = false;
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
    const controls = new OrbitControls(camera, renderer.domElement)

    mapContainer.value.addEventListener('mousemove', (event) => {
        mouseMoving = true;
        const element = event.currentTarget;

        const x = event.clientX - element.offsetLeft;
        const y = event.clientY - element.offsetTop;

        const w = element.offsetWidth;
        const h = element.offsetHeight;

        mouse.x = (x / w) * 2 - 1;
        mouse.y = (y / h) * -2 + 1
    }, false );

    mapContainer.value.addEventListener('mouseleave', (event) => {
        mouseMoving = false;
    }, false );

    const group = new THREE.Group()
    const polygonGroup = new THREE.Group()
    group.add(polygonGroup)
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

    loadGeoJSON('/data/ne_110m_admin_0_countries.geojson').then(geojson => {
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
            const props = feature.properties
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
                polygonMesh.userData = { ...polygonMesh.userData, ...props };
                polygonGroup.add(polygonMesh);

                const polygonBackMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color("hsl(" + (outerRingLonLat.length % 360) + ", 50%, 20%)"), side: THREE.BackSide })
                const polygonBackMesh = new THREE.Mesh(polygonGeometry, polygonBackMaterial)
                group.add(polygonBackMesh);
            
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

    tick();
    // 毎フレーム時に実行されるループイベントです
    function tick() {
        if(!mouseMoving){
            requestAnimationFrame(tick);
            return;
        }
        // レイキャスト = マウス位置からまっすぐに伸びる光線ベクトルを生成
        raycaster.setFromCamera(mouse, camera);

        // その光線とぶつかったオブジェクトを得る
        const intersects = raycaster.intersectObjects(polygonGroup.children);

        if(intersects.length > 0){
            selectedCountry.value = intersects[0].object.userData.ADMIN;
        } else {
            selectedCountry.value = null;
        }

        // レンダリング
        //renderer.render(scene, camera);
        requestAnimationFrame(tick);
    }


    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
    })  

    const speach = (message) => {
        const uttr = new SpeechSynthesisUtterance(message);
        uttr.lang = 'en-US';
        speechSynthesis.cancel();
        speechSynthesis.speak(uttr)
    }   

    watch(selectedCountry, newValue => {
        if(newValue) {
            polygonGroup.children.forEach(child => {
                if(child.userData.ADMIN === selectedCountry.value){
                    child.userData.originalColor = child.material.color.getHex();
                    child.material.color.set(0xff0099);
                    child.scale.set(1.02, 1.02, 1.02);
                } else {
                    if(child.userData.originalColor === undefined){
                        child.userData.originalColor = child.material.color.getHex();
                    }
                    child.material.color.set(child.userData.originalColor);
                    child.scale.set(1.0, 1.0, 1.0);
                }
            })
            document.body.style.cursor = 'pointer';
            speach(selectedCountry.value);

        } else {
            polygonGroup.children.forEach(child => {
                child.material.color.set(child.userData.originalColor);
                child.scale.set(1.0, 1.0, 1.0);
            })
            document.body.style.cursor = 'default';
        }
    });
})


</script>

<template>
    <h2>{{selectedCountry ? selectedCountry : 'Hover over a country'}}</h2>
    <div ref="mapContainer" class="map-container"></div>
    <div class="modal" @click="showModal = false" v-if="showModal">
            <div class="modal-message"> Click to Start</div>
    </div>
</template>

<style scoped>
h2 {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    z-index: 1;
    font-family: sans-serif;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 5px 40px;
    border-radius: 5px;
}
.map-container {
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle at center,  #1d133bff, #000000, #1d133bff, #000000);
}
.modal {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2;
}
.modal-message {
    color: white;
    font-size: 24px;
    font-family: sans-serif;
    background-color: rgba(0, 0, 0, 0.5);
    padding: 20px 40px;
    border-radius: 10px;
}
</style>