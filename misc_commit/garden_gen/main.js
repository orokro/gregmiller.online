import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GardenSystem } from './GardenSystem.js';

let scene, camera, renderer, controls;
let ground, grassMesh;
let targetPrisms = [];
let wireframeEnabled = true;
let clock = new THREE.Clock();
let gardenSystem;
let loadedModels = {};

// Persistence helpers
const getVal = (key, def) => localStorage.getItem('g_' + key) !== null ? localStorage.getItem('g_' + key) : def;
const setVal = (key, val) => localStorage.setItem('g_' + key, val);

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
    const prngSeedInput = document.getElementById('prngSeed');

    const gardenSettingsInput = document.getElementById('gardenSettings');
    const blockSettingsInput = document.getElementById('blockSettings');

    // Load Persistence
    wireframeInput.checked = getVal('wireframe', 'true') === 'true';
    wireframeEnabled = wireframeInput.checked;
    hdrIntensityInput.value = getVal('hdrIntensity', '1.0');
    groundWidthInput.value = getVal('groundWidth', '18');
    groundHeightInput.value = getVal('groundHeight', '15');
    grassDensityInput.value = getVal('grassDensity', '50000');
    bladeMinLengthInput.value = getVal('bladeMinLength', '0.2');
    bladeMaxLengthInput.value = getVal('bladeMaxLength', '0.5');
    bladeMinWidthInput.value = getVal('bladeMinWidth', '0.02');
    bladeMaxWidthInput.value = getVal('bladeMaxWidth', '0.05');
    bladeMinTipWidthInput.value = getVal('bladeMinTipWidth', '0.0');
    bladeMaxTipWidthInput.value = getVal('bladeMaxTipWidth', '0.01');
    bladeSegmentsInput.value = getVal('bladeSegments', '4');
    bendIntensityInput.value = getVal('bendIntensity', '0.5');
    noiseScaleInput.value = getVal('noiseScale', '2.0');
    windIntensityInput.value = getVal('windIntensity', '0.3');
    windXInput.value = getVal('windX', '1.0');
    windYInput.value = getVal('windY', '1.0');
    planeColorInput.value = getVal('planeColor', '#3d2b1f');
    grassColor1Input.value = getVal('grassColor1', '#4da83b');
    grassColor2Input.value = getVal('grassColor2', '#83da4a');
    prismWidthInput.value = getVal('prismWidth', '10');
    prismDepthInput.value = getVal('prismDepth', '5');
    prismSpacingInput.value = getVal('prismSpacing', '2');
    prismHeightsInput.value = getVal('prismHeights', '10, 6, 7');
    prngSeedInput.value = getVal('prngSeed', 'garden_seed_123');
    
    const defaultGardenSettings = {
        snails: { density: 10, minScale: 0.5, maxScale: 1.2, seed: "snail_v1", yOffset: 0.1, randomRotation: true },
        flowers: { density: 30, minScale: 0.8, maxScale: 1.5, seed: "flower_v1", yOffset: 0.0, randomRotation: true },
        leaves: { density: 50, minScale: 0.3, maxScale: 0.8, seed: "leaf_v1", yOffset: 0.0, randomRotation: true }
    };

    const defaultBlockSettings = {
        blockScaleSize: 1.0,
        overScaleDepth: 1.1,
        centerScaler: 1.666666667,
        uvScale: 1.0,
        reprojectUVs: true,
        blockHasSnailsOdds: 0.7,
        maxSnails: 2,
        minSnailScale: 3.0,
        maxSnailScale: 5.0,
        snailXOffset: 0.0,
        snailYOffset: -0.04,
        snailZOffset: 0.0,
        debugSnails: true,
        snailAnimationSpeed: 1,
        snailRotationMultiplier: [0, 1, 0],
        snailRotationXOffset: 0,
        snailRotationYOffset: 0,
        snailRotationZOffset: 0
    };

    if (localStorage.getItem('g_gardenSettings')) {
        try {
            const saved = JSON.parse(localStorage.getItem('g_gardenSettings'));
            const merged = { ...defaultGardenSettings, ...saved };
            gardenSettingsInput.value = JSON.stringify(merged, null, 2);
        } catch (e) {
            gardenSettingsInput.value = JSON.stringify(defaultGardenSettings, null, 2);
        }
    } else {
        gardenSettingsInput.value = JSON.stringify(defaultGardenSettings, null, 2);
    }

    if (localStorage.getItem('g_blockSettings')) {
        try {
            const saved = JSON.parse(localStorage.getItem('g_blockSettings'));
            const merged = { ...defaultBlockSettings, ...saved };
            blockSettingsInput.value = JSON.stringify(merged, null, 2);
        } catch (e) {
            blockSettingsInput.value = JSON.stringify(defaultBlockSettings, null, 2);
        }
    } else {
        blockSettingsInput.value = JSON.stringify(defaultBlockSettings, null, 2);
    }

    // Three.js Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 40); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = parseFloat(hdrIntensityInput.value);
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

    // Load Assets
    try {
        const rgbeLoader = new RGBELoader();
        const texture = await rgbeLoader.loadAsync('env.hdr');
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;

        // Dark gradient background
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, 2);
        gradient.addColorStop(0, '#1a1a1a');
        gradient.addColorStop(1, '#000000');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 2);
        scene.background = new THREE.CanvasTexture(canvas);

        const gltfLoader = new GLTFLoader();
        const [block, snail, sunflower, leaves] = await Promise.all([
            gltfLoader.loadAsync('models/GardenBlock.glb'),
            gltfLoader.loadAsync('models/Snail.glb'),
            gltfLoader.loadAsync('models/Sunflower.glb'),
            gltfLoader.loadAsync('models/Leaves.glb')
        ]);

        loadedModels = {
            block: block.scene,
            snail: snail.scene,
            sunflower: sunflower.scene,
            leaves: leaves.scene
        };

        // Initialize GardenSystem
        rebuildGarden();

    } catch (e) {
        console.error("Failed to load assets", e);
    }

    function rebuildGarden() {
        if (gardenSystem) {
            gardenSystem.cleanup();
            scene.remove(gardenSystem);
        }

        let gSettings = {};
        let bSettings = {};
        try {
            gSettings = JSON.parse(gardenSettingsInput.value);
            bSettings = JSON.parse(blockSettingsInput.value);
        } catch(e) {
            console.warn("Invalid JSON settings", e);
        }

        gardenSystem = new GardenSystem(
            loadedModels,
            ground,
            targetPrisms,
            gSettings,
            bSettings,
            prngSeedInput.value
        );
        scene.add(gardenSystem);
        scene.updateMatrixWorld(true);
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
                float currentWidth = mix(aWidth, aTipWidth, uv.y);
                pos.x *= currentWidth;
                pos.y *= aSize;
                float angle = aAngle;
                float s = sin(angle);
                float c = cos(angle);
                float rx = pos.x * c - pos.z * s;
                float rz = pos.x * s + pos.z * c;
                pos.x = rx;
                pos.z = rz;
                float windFactor = uv.y * uv.y;
                float noiseVal = noise(vec3(aOffset.xy * uNoiseScale, uTime * 0.5));
                vec2 windMove = uWindDirection * uWindIntensity * (noiseVal + 0.5);
                pos.x += windMove.x * windFactor;
                pos.y += windMove.y * windFactor;
                float bendX = sin(aAngle * 1.5) * uBendIntensity;
                float bendY = cos(aAngle * 1.5) * uBendIntensity;
                pos.x += bendX * windFactor;
                pos.y += bendY * windFactor;
                pos.z += windFactor * uBendIntensity * 0.5;
                vec3 finalLocal;
                finalLocal.x = pos.x;
                finalLocal.y = pos.y;
                finalLocal.z = pos.z;
                vec3 normalOriented;
                normalOriented.x = finalLocal.x;
                normalOriented.y = -finalLocal.z;
                normalOriented.z = finalLocal.y;
                vec3 worldPos = aOffset + normalOriented;
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
        setVal('wireframe', wireframeEnabled);
        targetPrisms.forEach(p => {
            p.material.wireframe = wireframeEnabled;
            p.visible = wireframeEnabled;
            const occluder = p.getObjectByName("occluder");
            if (occluder) occluder.visible = wireframeEnabled;
        });
    });

    setupDraggable(hdrIntensityInput, (v) => {
        renderer.toneMappingExposure = v;
        setVal('hdrIntensity', v);
    });

    setupDraggable(groundWidthInput, (v) => {
        ground.scale.x = v;
        setVal('groundWidth', v);
        initGrass();
    }, 0.1);

    setupDraggable(groundHeightInput, (v) => {
        ground.scale.y = v;
        setVal('groundHeight', v);
        initGrass();
    }, 0.1);

    setupDraggable(grassDensityInput, (v) => { setVal('grassDensity', v); initGrass(); }, 0);
    setupDraggable(bladeMinLengthInput, (v) => { setVal('bladeMinLength', v); initGrass(); }, 0);
    setupDraggable(bladeMaxLengthInput, (v) => { setVal('bladeMaxLength', v); initGrass(); }, 0);
    setupDraggable(bladeMinWidthInput, (v) => { setVal('bladeMinWidth', v); initGrass(); }, 0);
    setupDraggable(bladeMaxWidthInput, (v) => { setVal('bladeMaxWidth', v); initGrass(); }, 0);
    setupDraggable(bladeMinTipWidthInput, (v) => { setVal('bladeMinTipWidth', v); initGrass(); }, 0);
    setupDraggable(bladeMaxTipWidthInput, (v) => { setVal('bladeMaxTipWidth', v); initGrass(); }, 0);
    setupDraggable(bladeSegmentsInput, (v) => { setVal('bladeSegments', v); initGrass(); }, 1);
    
    setupDraggable(bendIntensityInput, (v) => { 
        grassMaterial.uniforms.uBendIntensity.value = v; 
        setVal('bendIntensity', v);
    });
    setupDraggable(noiseScaleInput, (v) => { 
        grassMaterial.uniforms.uNoiseScale.value = v; 
        setVal('noiseScale', v);
    });
    setupDraggable(windIntensityInput, (v) => { 
        grassMaterial.uniforms.uWindIntensity.value = v; 
        setVal('windIntensity', v);
    });
    setupDraggable(windXInput, (v) => { 
        grassMaterial.uniforms.uWindDirection.value.x = v; 
        setVal('windX', v);
    });
    setupDraggable(windYInput, (v) => { 
        grassMaterial.uniforms.uWindDirection.value.y = v; 
        setVal('windY', v);
    });
    
    planeColorInput.addEventListener('input', (e) => { 
        ground.material.color.set(e.target.value); 
        setVal('planeColor', e.target.value);
    });
    grassColor1Input.addEventListener('input', (e) => { 
        grassMaterial.uniforms.uColor1.value.set(e.target.value); 
        setVal('grassColor1', e.target.value);
    });
    grassColor2Input.addEventListener('input', (e) => { 
        grassMaterial.uniforms.uColor2.value.set(e.target.value); 
        setVal('grassColor2', e.target.value);
    });

    setupDraggable(prismWidthInput, (v) => {
        targetPrisms.forEach(p => p.scale.x = v);
        setVal('prismWidth', v);
        if (gardenSystem) gardenSystem.update(targetPrisms);
    }, 0.1);

    setupDraggable(prismDepthInput, (v) => {
        targetPrisms.forEach(p => {
            p.scale.z = v;
            p.position.z = v / 2;
        });
        setVal('prismDepth', v);
        if (gardenSystem) gardenSystem.update(targetPrisms);
    }, 0.1);

    setupDraggable(prismSpacingInput, (v) => {
        updatePrismPositions();
        setVal('prismSpacing', v);
        if (gardenSystem) gardenSystem.update(targetPrisms);
    });

    prismHeightsInput.addEventListener('input', () => {
        regeneratePrisms();
        setVal('prismHeights', prismHeightsInput.value);
    });

    prngSeedInput.addEventListener('input', () => {
        setVal('prngSeed', prngSeedInput.value);
        rebuildGarden();
    });

    gardenSettingsInput.addEventListener('input', () => {
        setVal('gardenSettings', gardenSettingsInput.value);
        rebuildGarden();
    });
    blockSettingsInput.addEventListener('input', () => {
        setVal('blockSettings', blockSettingsInput.value);
        rebuildGarden();
    });

    window.addEventListener('resize', onWindowResize);

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
            offsets[i * 3 + 2] = 0.01;
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
        grassMesh.renderOrder = 2;
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
        prism.renderOrder = 1;
        prism.visible = wireframeEnabled;
        scene.add(prism);
        targetPrisms.push(prism);
        const occluderMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
        const occluder = new THREE.Mesh(boxGeom, occluderMat);
        occluder.renderOrder = 0;
        occluder.name = "occluder";
        prism.add(occluder);
        currentY += ySize + prismSpacing;
    });
    if (gardenSystem) gardenSystem.update(targetPrisms);
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
    if (gardenSystem) gardenSystem.update(targetPrisms);
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
    if (gardenSystem) {
        gardenSystem.updateAnimation(time);
    }
    controls.update();
    renderer.render(scene, camera);
}

init();
