import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

let scene, camera, renderer, controls;
let ground, grassMesh;
let targetPrisms = [];
let wireframeEnabled = true;
let clock = new THREE.Clock();

async function init() {
    const container = document.getElementById('canvas-container');

    // UI Elements
    const wireframeInput = document.getElementById('wireframe');
    const hdrIntensityInput = document.getElementById('hdrIntensity');
    const groundWidthInput = document.getElementById('groundWidth');
    const groundHeightInput = document.getElementById('groundHeight');

    // Grass UI
    const grassDensityInput = document.getElementById('grassDensity');
    const bladeMinLengthInput = document.getElementById('bladeMinLength');
    const bladeMaxLengthInput = document.getElementById('bladeMaxLength');
    const bladeMinWidthInput = document.getElementById('bladeMinWidth');
    const bladeMaxWidthInput = document.getElementById('bladeMaxWidth');
    const bladeMinTipWidthInput = document.getElementById('bladeMinTipWidth');
    const bladeMaxTipWidthInput = document.getElementById('bladeMaxTipWidth');
    const bladeSegmentsInput = document.getElementById('bladeSegments');
    
    const bendIntensityInput = document.getElementById('bendIntensity');
    const noiseScaleInput = document.getElementById('noiseScale');
    const windIntensityInput = document.getElementById('windIntensity');
    const windXInput = document.getElementById('windX');
    const windYInput = document.getElementById('windY');
    const planeColorInput = document.getElementById('planeColor');
    const grassColor1Input = document.getElementById('grassColor1');
    const grassColor2Input = document.getElementById('grassColor2');

    const prismWidthInput = document.getElementById('prismWidth');
    const prismDepthInput = document.getElementById('prismDepth');
    const prismSpacingInput = document.getElementById('prismSpacing');
    const prismHeightsInput = document.getElementById('prismHeights');

    // Three.js Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 40); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    // Ground Plane
    const groundGeometry = new THREE.PlaneGeometry(1, 1);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: planeColorInput.value, 
        side: THREE.DoubleSide 
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.name = 'ground';
    scene.add(ground);

    // Initial Scales for Ground
    ground.scale.set(parseFloat(groundWidthInput.value), parseFloat(groundHeightInput.value), 1);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(20, 20, 40);
    scene.add(dirLight);

    // Load HDR
    try {
        const rgbeLoader = new RGBELoader();
        const texture = await rgbeLoader.loadAsync('env.hdr');
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.background = texture;
    } catch (e) {
        console.error("Failed to load HDR", e);
    }

    // Grass Material
    const grassMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uNoiseScale: { value: parseFloat(noiseScaleInput.value) },
            uWindIntensity: { value: parseFloat(windIntensityInput.value) },
            uWindDirection: { value: new THREE.Vector2(parseFloat(windXInput.value), parseFloat(windYInput.value)) },
            uColor1: { value: new THREE.Color(grassColor1Input.value) },
            uColor2: { value: new THREE.Color(grassColor2Input.value) },
            uBendIntensity: { value: parseFloat(bendIntensityInput.value) }
        },
        vertexShader: `
            uniform float uTime;
            uniform float uNoiseScale;
            uniform float uWindIntensity;
            uniform vec2 uWindDirection;
            uniform float uBendIntensity;

            attribute float aSize;
            attribute float aWidth;
            attribute float aTipWidth;
            attribute vec3 aOffset;
            attribute float aAngle;

            varying float vHeightPercent;
            varying float vRandom;

            // Simple noise function
            float hash(float n) { return fract(sin(n) * 43758.5453123); }
            float noise(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f*f*(3.0-2.0*f);
                float n = p.x + p.y*57.0 + 113.0*p.z;
                return mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
                               mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y),
                           mix(mix( hash(n+113.0), hash(n+114.0),f.x),
                               mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
            }

            void main() {
                vHeightPercent = uv.y;
                vRandom = aAngle;

                vec3 pos = position;
                
                // Taper width
                float currentWidth = mix(aWidth, aTipWidth, uv.y);
                pos.x *= currentWidth;

                // Scale length
                pos.y *= aSize;
                
                // Wind and Sway
                float windFactor = uv.y * uv.y;
                float noiseVal = noise(vec3(aOffset.xy * uNoiseScale, uTime * 0.5));
                vec2 windMove = uWindDirection * uWindIntensity * (noiseVal + 0.5);
                
                // Random rotation
                float angle = aAngle;
                float s = sin(angle);
                float c = cos(angle);
                float localX = pos.x * c - pos.z * s;
                float localZ = pos.x * s + pos.z * c;
                pos.x = localX;
                pos.z = localZ;

                // Apply movements
                pos.x += windMove.x * windFactor;
                pos.y += windMove.y * windFactor;
                pos.x += sin(aAngle) * uBendIntensity * windFactor;
                pos.y += cos(aAngle) * uBendIntensity * windFactor;

                vec3 worldPos = aOffset + pos;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            varying float vHeightPercent;
            varying float vRandom;

            void main() {
                float shade = mix(0.2, 1.0, vHeightPercent);
                vec3 baseColor = mix(uColor1, uColor2, fract(vRandom * 7.0));
                gl_FragColor = vec4(baseColor * shade, 1.0);
            }
        `,
        side: THREE.DoubleSide
    });

    // Setup UI Events
    wireframeInput.addEventListener('change', (e) => {
        wireframeEnabled = e.target.checked;
        targetPrisms.forEach(p => {
            p.material.wireframe = wireframeEnabled;
            p.visible = wireframeEnabled;
        });
    });

    setupDraggable(hdrIntensityInput, (v) => {
        renderer.toneMappingExposure = v;
    });

    setupDraggable(groundWidthInput, (v) => {
        ground.scale.x = v;
        initGrass();
    }, 0.1);

    setupDraggable(groundHeightInput, (v) => {
        ground.scale.y = v;
        initGrass();
    }, 0.1);

    // Grass UI Listeners
    setupDraggable(grassDensityInput, (v) => initGrass(), 0);
    setupDraggable(bladeMinLengthInput, (v) => initGrass(), 0);
    setupDraggable(bladeMaxLengthInput, (v) => initGrass(), 0);
    setupDraggable(bladeMinWidthInput, (v) => initGrass(), 0);
    setupDraggable(bladeMaxWidthInput, (v) => initGrass(), 0);
    setupDraggable(bladeMinTipWidthInput, (v) => initGrass(), 0);
    setupDraggable(bladeMaxTipWidthInput, (v) => initGrass(), 0);
    setupDraggable(bladeSegmentsInput, (v) => initGrass(), 1);
    
    setupDraggable(bendIntensityInput, (v) => { grassMaterial.uniforms.uBendIntensity.value = v; });
    setupDraggable(noiseScaleInput, (v) => { grassMaterial.uniforms.uNoiseScale.value = v; });
    setupDraggable(windIntensityInput, (v) => { grassMaterial.uniforms.uWindIntensity.value = v; });
    setupDraggable(windXInput, (v) => { grassMaterial.uniforms.uWindDirection.value.x = v; });
    setupDraggable(windYInput, (v) => { grassMaterial.uniforms.uWindDirection.value.y = v; });
    
    planeColorInput.addEventListener('input', (e) => { ground.material.color.set(e.target.value); });
    grassColor1Input.addEventListener('input', (e) => { grassMaterial.uniforms.uColor1.value.set(e.target.value); });
    grassColor2Input.addEventListener('input', (e) => { grassMaterial.uniforms.uColor2.value.set(e.target.value); });

    // Prism UI Events
    setupDraggable(prismWidthInput, (v) => {
        targetPrisms.forEach(p => p.scale.x = v);
    }, 0.1);

    setupDraggable(prismDepthInput, (v) => {
        targetPrisms.forEach(p => {
            p.scale.z = v;
            p.position.z = v / 2;
        });
    }, 0.1);

    setupDraggable(prismSpacingInput, (v) => {
        updatePrismPositions();
    });

    prismHeightsInput.addEventListener('input', () => {
        regeneratePrisms();
    });

    window.addEventListener('resize', onWindowResize);

    // Initialization
    function initGrass() {
        if (grassMesh) {
            scene.remove(grassMesh);
            grassMesh.geometry.dispose();
        }

        const count = parseInt(grassDensityInput.value);
        const minLen = parseFloat(bladeMinLengthInput.value);
        const maxLen = parseFloat(bladeMaxLengthInput.value);
        const minWid = parseFloat(bladeMinWidthInput.value);
        const maxWid = parseFloat(bladeMaxWidthInput.value);
        const minTipWid = parseFloat(bladeMinTipWidthInput.value);
        const maxTipWid = parseFloat(bladeMaxTipWidthInput.value);
        const segments = parseInt(bladeSegmentsInput.value);
        
        const gW = ground.scale.x;
        const gH = ground.scale.y;

        // Base blade geometry (unit width/height, scaled in shader)
        const baseGeom = new THREE.PlaneGeometry(1, 1, 1, segments);
        baseGeom.translate(0, 0.5, 0); 

        const instancedGeom = new THREE.InstancedBufferGeometry();
        instancedGeom.index = baseGeom.index;
        instancedGeom.attributes.position = baseGeom.attributes.position;
        instancedGeom.attributes.uv = baseGeom.attributes.uv;

        const offsets = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const widths = new Float32Array(count);
        const tipWidths = new Float32Array(count);
        const angles = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            offsets[i * 3] = (Math.random() - 0.5) * gW;
            offsets[i * 3 + 1] = (Math.random() - 0.5) * gH;
            offsets[i * 3 + 2] = 0; 

            sizes[i] = minLen + Math.random() * (maxLen - minLen);
            widths[i] = minWid + Math.random() * (maxWid - minWid);
            tipWidths[i] = minTipWid + Math.random() * (maxTipWid - minTipWid);
            angles[i] = Math.random() * Math.PI * 2;
        }

        instancedGeom.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
        instancedGeom.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1));
        instancedGeom.setAttribute('aWidth', new THREE.InstancedBufferAttribute(widths, 1));
        instancedGeom.setAttribute('aTipWidth', new THREE.InstancedBufferAttribute(tipWidths, 1));
        instancedGeom.setAttribute('aAngle', new THREE.InstancedBufferAttribute(angles, 1));

        grassMesh = new THREE.Mesh(instancedGeom, grassMaterial);
        grassMesh.frustumCulled = false; 
        scene.add(grassMesh);
    }

    initGrass();
    regeneratePrisms();

    animate();
}

function regeneratePrisms() {
    targetPrisms.forEach(p => scene.remove(p));
    targetPrisms = [];

    const prismWidth = parseFloat(document.getElementById('prismWidth').value) || 10;
    const prismDepth = parseFloat(document.getElementById('prismDepth').value) || 5;
    const prismSpacing = parseFloat(document.getElementById('prismSpacing').value) || 2;
    const heightsCSV = document.getElementById('prismHeights').value;

    const ySizes = heightsCSV.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (ySizes.length === 0) return;

    const totalYLength = ySizes.reduce((a, b) => a + b, 0) + (ySizes.length - 1) * prismSpacing;
    let currentY = -totalYLength / 2;

    const boxGeom = new THREE.BoxGeometry(1, 1, 1);

    ySizes.forEach((ySize) => {
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x83da4a, 
            wireframe: wireframeEnabled,
            transparent: true,
            opacity: 0.8
        });
        const prism = new THREE.Mesh(boxGeom, mat);
        prism.scale.set(prismWidth, ySize, prismDepth);
        prism.position.set(0, currentY + ySize / 2, prismDepth / 2);
        
        prism.visible = wireframeEnabled;
        scene.add(prism);
        targetPrisms.push(prism);
        
        currentY += ySize + prismSpacing;
    });
}

function updatePrismPositions() {
    const prismSpacing = parseFloat(document.getElementById('prismSpacing').value) || 2;
    const ySizes = targetPrisms.map(p => p.scale.y);
    const totalYLength = ySizes.reduce((a, b) => a + b, 0) + (ySizes.length - 1) * prismSpacing;
    let currentY = -totalYLength / 2;

    targetPrisms.forEach((prism, i) => {
        const ySize = ySizes[i];
        prism.position.y = currentY + ySize / 2;
        currentY += ySize + prismSpacing;
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupDraggable(input, onUpdate, minVal = null) {
    if (!input) return;
    let isDragging = false;
    let startX = 0;
    let startVal = 0;

    input.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startVal = parseFloat(input.value) || 0;
        input.classList.add('dragging');
        document.body.style.cursor = 'ew-resize';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = e.clientX - startX;
        const speed = e.shiftKey ? 0.01 : 0.1;
        let newVal = Math.round((startVal + delta * speed) * 100) / 100;
        if (minVal !== null) newVal = Math.max(minVal, newVal);
        input.value = newVal;
        onUpdate(newVal);
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            input.classList.remove('dragging');
            document.body.style.cursor = 'default';
        }
    });

    input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        if (!isNaN(val)) onUpdate(val);
    });
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    if (grassMesh && grassMesh.material.uniforms.uTime) {
        grassMesh.material.uniforms.uTime.value = time;
    }

    controls.update();
    renderer.render(scene, camera);
}

init();