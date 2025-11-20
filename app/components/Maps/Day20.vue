<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

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


onMounted(async () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({alpha: true})
    renderer.setClearColor(0x000000, 0) // 背景を透明に設定
    const controls = new OrbitControls(camera, renderer.domElement)

    const clock = new THREE.Clock()

    const group = new THREE.Group()
    scene.add(group)

    const ambientLight = new THREE.AmbientLight(0xffffff, 2)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(5, 3, 5)
    scene.add(sunLight)

    const animate = function () {
        requestAnimationFrame(animate)
        const elapsed = clock.getElapsedTime()
        sea.material.uniforms.time.value = elapsed
        renderer.render(scene, camera)
    }

    const loadGeoJSON = async (url) => {
        const response = await fetch(url)
        const data = await response.json()
        return data
    }

    mapContainer.value.appendChild(renderer.domElement)
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.position.y = 0
    camera.position.z = 2
    camera.lookAt(new THREE.Vector3(0, 0, 0))

    const seaGeometry = new THREE.PlaneGeometry(5, 5)
    const seaMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec2 vUv;
            
            // 3Dノイズ関数
            vec3 mod289(vec3 x) {
                return x - floor(x * (1.0 / 289.0)) * 289.0;
            }
            
            vec4 mod289(vec4 x) {
                return x - floor(x * (1.0 / 289.0)) * 289.0;
            }
            
            vec4 permute(vec4 x) {
                return mod289(((x*34.0)+1.0)*x);
            }
            
            vec4 taylorInvSqrt(vec4 r) {
                return 1.79284291400159 - 0.85373472095314 * r;
            }
            
            vec3 fade(vec3 t) {
                return t*t*t*(t*(t*6.0-15.0)+10.0);
            }
            
            // Perlin noise
            float noise(vec3 P) {
                vec3 Pi0 = floor(P);
                vec3 Pi1 = Pi0 + vec3(1.0);
                Pi0 = mod289(Pi0);
                Pi1 = mod289(Pi1);
                vec3 Pf0 = fract(P);
                vec3 Pf1 = Pf0 - vec3(1.0);
                vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
                vec4 iy = vec4(Pi0.yy, Pi1.yy);
                vec4 iz0 = Pi0.zzzz;
                vec4 iz1 = Pi1.zzzz;
                
                vec4 ixy = permute(permute(ix) + iy);
                vec4 ixy0 = permute(ixy + iz0);
                vec4 ixy1 = permute(ixy + iz1);
                
                vec4 gx0 = ixy0 * (1.0 / 7.0);
                vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
                gx0 = fract(gx0);
                vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
                vec4 sz0 = step(gz0, vec4(0.0));
                gx0 -= sz0 * (step(0.0, gx0) - 0.5);
                gy0 -= sz0 * (step(0.0, gy0) - 0.5);
                
                vec4 gx1 = ixy1 * (1.0 / 7.0);
                vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
                gx1 = fract(gx1);
                vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
                vec4 sz1 = step(gz1, vec4(0.0));
                gx1 -= sz1 * (step(0.0, gx1) - 0.5);
                gy1 -= sz1 * (step(0.0, gy1) - 0.5);
                
                vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
                vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
                vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
                vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
                vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
                vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
                vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
                vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
                
                vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
                g000 *= norm0.x;
                g010 *= norm0.y;
                g100 *= norm0.z;
                g110 *= norm0.w;
                vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
                g001 *= norm1.x;
                g011 *= norm1.y;
                g101 *= norm1.z;
                g111 *= norm1.w;
                
                float n000 = dot(g000, Pf0);
                float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
                float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
                float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
                float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
                float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
                float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
                float n111 = dot(g111, Pf1);
                
                vec3 fade_xyz = fade(Pf0);
                vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
                vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
                float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
                return 2.2 * n_xyz;
            }
            
            // フラクタルノイズで複雑な波を生成
            float fbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;
                float frequency = 1.0;
                
                for(int i = 0; i < 10; i++) {
                    value += amplitude * noise(p * frequency);
                    frequency *= 2.0;
                    amplitude *= 0.5;
                }
                return value;
            }
            
            void main() {
                // 複数の波を重ねて自然な海の揺らめきを作成
                vec2 uv = vUv * 3.0;
                
                // 大きな波
                float wave1 = fbm(vec3(uv * 0.5 + time * 0.1, time * 0.15));
                
                // 中くらいの波
                float wave2 = fbm(vec3(uv * 1.0 + time * 0.2, time * 0.25));
                
                // 小さな波（さざ波）
                float wave3 = fbm(vec3(uv * 2.0 - time * 0.3, time * 0.4));
                
                // 波を合成
                float waves = wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2;
                
                // よりコントラストの強い色設定
                vec3 deepOcean = vec3(0.0, 0.0, 0.0);      // 暗い深海
                vec3 midOcean = vec3(0.05, 0.3, 0.4);      // 中間の海
                vec3 lightOcean = vec3(0.2, 0.7, 0.7);     // 明るい海
                vec3 foam = vec3(0.6, 0.8, 0.95);          // 白い泡
                
                // 波の値を強調してコントラストを増す
                float enhancedWaves = pow(waves * 0.5 + 0.5, 1.5);
                
                // 3段階で色を変化させる
                vec3 color;
                if (enhancedWaves < 0.4) {
                    // 深い部分
                    color = mix(deepOcean, midOcean, enhancedWaves / 0.4);
                } else if (enhancedWaves < 0.7) {
                    // 中間部分
                    color = mix(midOcean, lightOcean, (enhancedWaves - 0.4) / 0.3);
                } else {
                    // 明るい波頭
                    color = mix(lightOcean, foam, (enhancedWaves - 0.7) / 0.3);
                }
                
                // 波の頂点に強いハイライトを追加
                float highlight = smoothstep(0.6, 0.95, waves);
                color = mix(color, foam, highlight * 0.6);
                
                // さらに鋭い白い波頭を追加
                float sharpHighlight = smoothstep(0.85, 1.0, waves);
                color = mix(color, vec3(1.0, 1.0, 1.0), sharpHighlight * 0.4);
                
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
    const sea = new THREE.Mesh(seaGeometry, seaMaterial);
    sea.position.z = -0.1;
    scene.add(sea);

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
            const depth = 0.01
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
                color: 0x103060,
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
            const lineMaterial3D = new THREE.LineBasicMaterial({ color: 0x999999 });
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
