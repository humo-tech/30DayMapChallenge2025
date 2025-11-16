<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import ClipperLib from 'clipper-lib'

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.app.baseURL || ''

const mapContainer = ref(null)

const LAT_N = 90.0
const LAT_S = -90.0
const LON_W = -180.0
const LON_E = 180.0

const latlon2xy = (lat, lon) => {
    const ratio = (LON_E - LON_W) / (LAT_N - LAT_S)
    const x = ((lon - LON_W) / (LON_E - LON_W) - 0.5) * 2.0 * ratio
    const y = ((lat - LAT_S) / (LAT_N - LAT_S) - 0.5) * 2.0

    return [x, y]
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
    renderer.setClearColor(0x000000, 1)
    renderer.shadowMap.enabled = true
    const controls = new OrbitControls(camera, renderer.domElement)
    const clock = new THREE.Clock()

    const group = new THREE.Group()
    scene.add(group)

    // store mapping of eyes to their polygon base centroids & depth
    const polygonEyes = []

    const ambientLight = new THREE.AmbientLight(0xf5f5f5, 2)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 5, 5)
    scene.add(sunLight)

    const animate = function () {
        requestAnimationFrame(animate)
        {
            // horizontal motion: use stored basePosition and update X/Y (keep Z)
            const time = clock.getElapsedTime() * 0.5;
            const getNoiseX = (bx, by, t) => Math.sin(bx * 10 + t) * 0.02;
            const getNoiseY = (bx, by, t) => Math.cos(by * 10 + t) * 0.02;

            group.traverse((child) => {
                const geometry = child.geometry
                if (!geometry) return
                const position = geometry.attributes.position
                const base = geometry.attributes.basePosition
                if (!position || !base) return

                for (let i = 0; i < position.count; i++) {
                    const bx = base.getX(i)
                    const by = base.getY(i)
                    const bz = base.getZ(i)
                    const ox = getNoiseX(bx, by, time)
                    const oy = getNoiseY(bx, by, time)
                    position.setX(i, bx + ox)
                    position.setY(i, by + oy)
                    position.setZ(i, bz) // keep original Z (thickness)
                }

                position.needsUpdate = true
                geometry.computeVertexNormals()
            })

            // update eyes to follow polygons' animated centroid
            for (let i = 0; i < polygonEyes.length; i++) {
                const item = polygonEyes[i]
                const bx = item.base.x
                const by = item.base.y
                const ox = getNoiseX(bx, by, time)
                const oy = getNoiseY(bx, by, time)
                item.eye.position.set(bx + ox, by + oy, item.depth + 0.002)
            }
         }

         renderer.render(scene, camera)
     }

    // make cell nuclei (like eyes)
    const eyeGeometry = new THREE.CircleGeometry(0.02, 64);
    // transform eyeGeometry as amebatic shape (BufferGeometry: mutate position attribute)
    {
        const pos = eyeGeometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const offset = (Math.sin(i*0.2) + Math.cos(i*0.1)) * 0.001; // Use a sin,cos function for smoother variation
            const x = pos.getX(i) + offset;
            const y = pos.getY(i) + offset;
            pos.setXY(i, x, y);
        }
        pos.needsUpdate = true;
        eyeGeometry.computeVertexNormals();
    }
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x9F6811 });
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.castShadow = true;
    eye.receiveShadow = true;
    const blackSphereGeometry = new THREE.CircleGeometry(0.005, 32);
    const blackSphereMaterial = new THREE.MeshPhongMaterial({ color: 0x9F9F17 });
    const blackSphere = new THREE.Mesh(blackSphereGeometry, blackSphereMaterial);
    blackSphere.position.set(0.002, 0, 0.005);
    //blackSphere.rotation.x = Math.PI / 2;
    eye.add(blackSphere);


    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.y = -0.4
    camera.position.z = 0.8
    camera.lookAt(new THREE.Vector3(0, 0, 0.2))

    const geojson = await loadGeoJSON(`${baseUrl}/data/ne_110m_admin_0_countries.geojson`)
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

            // Extrude the shape to give thickness
            const depth = 0.03
            const extrudeSettings = {
                depth: depth,
                bevelEnabled: false,
                curveSegments: 8,
                steps: 1
            }
            const polygonGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)

            // Convert geometry's lon/lat (x=lon, y=lat) to projected x,y while keeping z (thickness)
            const positions = polygonGeometry.attributes.position
            const flatPositions = []
            for (let i = 0; i < positions.count; i++) {
                const lon = positions.getX(i)
                const lat = positions.getY(i)
                const z = positions.getZ(i) // 0 .. depth
                const [x, y] = latlon2xy(lat, lon)
                flatPositions.push(x, y, z)
            }
            polygonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flatPositions, 3))
            // save original positions for animation
            polygonGeometry.setAttribute('basePosition', polygonGeometry.attributes.position.clone())
            polygonGeometry.computeVertexNormals()

            const polygonMaterial = new THREE.MeshPhongMaterial({ 
                color: 0xD1E9C0,
                side: THREE.DoubleSide,
            })
            const polygonMesh = new THREE.Mesh(polygonGeometry, polygonMaterial)
            group.add(polygonMesh);

            // top outline (slightly above top face)
            const topZ = depth + 0.001
            const linePoints3D = outerRingLonLat.map(([lon, lat]) => {
                const [x, y] = latlon2xy(lat, lon)
                return new THREE.Vector3(x, y, topZ)
            })
            const lineGeometry3D = new THREE.BufferGeometry().setFromPoints(linePoints3D)
            lineGeometry3D.setAttribute('basePosition', lineGeometry3D.attributes.position.clone())
            const lineMaterial3D = new THREE.LineBasicMaterial({ color: 0x11491c });
            const line3D = new THREE.Line(lineGeometry3D, lineMaterial3D)
            group.add(line3D);

            // --- add inner "cell wall" ring using clipper-lib for robust inset geometry ---
            {
                // clipper requires integer coords -> scale
                const scale = 1e4
                const outerPath = linePoints3D.map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }))

                // decide inset distance (world units), same heuristic as before
                const bbox = new THREE.Box2()
                linePoints3D.forEach(p => bbox.expandByPoint(new THREE.Vector2(p.x, p.y)))
                const size = Math.min(bbox.getSize(new THREE.Vector2()).x, bbox.getSize(new THREE.Vector2()).y)
                const inset = Math.max(0.001, Math.min(size * 0.06, 0.01))

                const co = new ClipperLib.ClipperOffset()
                co.AddPath(outerPath, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon)
                const solution = new ClipperLib.Paths()
                const delta = -Math.round(inset * scale) // negative -> inset
                co.Execute(solution, delta)

                let innerLoop2 = null
                if (solution && solution.length > 0 && solution[0].length >= 3) {
                    innerLoop2 = solution[0].map(pt => new THREE.Vector2(pt.X / scale, pt.Y / scale))
                } else {
                    // fallback: centroid-based inset if clipper fails
                    const centroid = new THREE.Vector2(0, 0)
                    linePoints3D.forEach(p => { centroid.x += p.x; centroid.y += p.y })
                    centroid.x /= linePoints3D.length; centroid.y /= linePoints3D.length
                    innerLoop2 = linePoints3D.map(p => {
                        const dir = new THREE.Vector2(centroid.x - p.x, centroid.y - p.y)
                        const len = dir.length() || 1
                        return new THREE.Vector2(p.x + (dir.x / len) * Math.min(inset, len * 0.9),
                                                 p.y + (dir.y / len) * Math.min(inset, len * 0.9))
                    })
                }

                // create a Shape with outer and inner hole, then make 2D geometry and lift it to topZ
                const outer2 = linePoints3D.map(p => new THREE.Vector2(p.x, p.y))
                const wallShape = new THREE.Shape(outer2)
                const holePath = new THREE.Path(innerLoop2)
                wallShape.holes.push(holePath)

                const wallGeo2D = new THREE.ShapeGeometry(wallShape)
                // lift geometry to the top face and store basePosition for animation
                const posAttr = wallGeo2D.attributes.position
                for (let i = 0; i < posAttr.count; i++) {
                    posAttr.setZ(i, topZ + 0.0002)
                }
                wallGeo2D.setAttribute('basePosition', wallGeo2D.attributes.position.clone())
                wallGeo2D.computeVertexNormals()

                const wallMat = new THREE.MeshPhongMaterial({
                    color: 0x9DBF8A,
                    side: THREE.DoubleSide,
                    shininess: 10,
                })
                const wallMesh = new THREE.Mesh(wallGeo2D, wallMat)
                group.add(wallMesh)
            }

            // put eye marker
            const polygonGravity = outerRingLonLat.reduce((acc, coord) => {
                acc[0] += coord[0]
                acc[1] += coord[1]
                return acc
            }, [0,0]).map(v => v / outerRingLonLat.length)
            const polygonCenterXY = latlon2xy(polygonGravity[1], polygonGravity[0])

            const polygonSize = outerRingLonLat.length

            const eyeClone = eye.clone()
            // compute base centroid from the geometry's basePosition (use top-face vertices)
            let cx = 0, cy = 0, count = 0
            const basePos = polygonGeometry.attributes.basePosition
            for (let i = 0; i < basePos.count; i++) {
                const bz = basePos.getZ(i)
                if (bz > depth / 2) { // top face vertices
                    cx += basePos.getX(i)
                    cy += basePos.getY(i)
                    count++
                }
            }
            if (count === 0) { cx = polygonCenterXY[0]; cy = polygonCenterXY[1]; }
            else { cx /= count; cy /= count; }

            eyeClone.position.set(cx, cy, depth + 0.002)
            const size = Math.min(polygonSize * 0.007, 1);
            eyeClone.scale.setScalar(size)
            eyeClone.rotation.z = Math.random()
            scene.add(eyeClone)

            // register for animation updates (store base centroid and depth)
            polygonEyes.push({ eye: eyeClone, base: new THREE.Vector3(cx, cy, depth), depth: depth })

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