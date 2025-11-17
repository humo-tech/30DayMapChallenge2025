<script setup>
import { Scene, Engine, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, SceneLoader, StandardMaterial, Color3 } from 'babylonjs'
import 'babylonjs-loaders'
const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''
const mapContainer = ref(null)

onMounted(async () => {
    const engine = new Engine(mapContainer.value, true) 
    const scene = new Scene(engine)

    const camera = new ArcRotateCamera("camera", -Math.PI, Math.PI / 3, 1000, new Vector3(0, 0, 0), scene)
    camera.attachControl(mapContainer.value, true)

    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene)

    const ground = MeshBuilder.CreateGround("ground", {width:1000, height:1000}, scene);
    ground.position.y = -110;
    const groundMaterial = new StandardMaterial("groundMat", scene);
    groundMaterial.diffuseColor = new Color3(0.1, 0.8, 0.4);
    ground.material = groundMaterial;

    // Load GLB file
    const buildings = await SceneLoader.AppendAsync(`${baseUrl}/data/day08/`, 'bldg_Building.glb', scene)

    // Start render loop
    engine.runRenderLoop(() => {
        scene.render()
    })

    window.addEventListener('resize', function(){
        engine.resize();
    });
})
</script>

<template>
    <canvas ref="mapContainer" class="map-container"></canvas>
</template>

<style scoped>
.map-container {
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle at center, #0b0812, #4d2c57, #231818, #000000)
}
</style>