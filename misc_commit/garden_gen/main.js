import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GardenSystem } from './GardenSystem.js';

let scene, camera, renderer, controls;
let ground;
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
    const createGardenBtn = document.getElementById('createGarden');
    const destroyGardenBtn = document.getElementById('destroyGarden');

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
    const grassSettingsInput = document.getElementById('grassSettings');

    // Load Persistence
    wireframeInput.checked = getVal('wireframe', 'true') === 'true';
    wireframeEnabled = wireframeInput.checked;
    hdrIntensityInput.value = getVal('hdrIntensity', '1.0');
    groundWidthInput.value = getVal('groundWidth', '18');
    groundHeightInput.value = getVal('groundHeight', '15');
    
    // Default Grass Settings
    const defaultGrassSettings = {
        density: 7000,
        minLength: 0,
        maxLength: 4,
        minWidth: 0.25,
        maxWidth: 0.68,
        minTipWidth: 0,
        maxTipWidth: 0.2,
        segments: 4,
        noiseScale: 2,
        windIntensity: 0.3,
        windX: 1,
        windY: 1,
        dirtColor: "#3d2b1f",
        grassColor1: "#4da83b",
        grassColor2: "#83da4a",
    };

    // Load or Init Grass Settings
    let grassSettings = { ...defaultGrassSettings };
    if (localStorage.getItem('g_grassSettings')) {
        try {
            const saved = JSON.parse(localStorage.getItem('g_grassSettings'));
            grassSettings = { ...defaultGrassSettings, ...saved };
        } catch (e) {
            console.warn("Invalid saved grass settings", e);
        }
    }
    grassSettingsInput.value = JSON.stringify(grassSettings, null, 2);

    // Sync Inputs to Loaded/Default Settings
    grassDensityInput.value = grassSettings.density;
    bladeMinLengthInput.value = grassSettings.minLength;
    bladeMaxLengthInput.value = grassSettings.maxLength;
    bladeMinWidthInput.value = grassSettings.minWidth;
    bladeMaxWidthInput.value = grassSettings.maxWidth;
    bladeMinTipWidthInput.value = grassSettings.minTipWidth;
    bladeMaxTipWidthInput.value = grassSettings.maxTipWidth;
    bladeSegmentsInput.value = grassSettings.segments;
    noiseScaleInput.value = grassSettings.noiseScale;
    windIntensityInput.value = grassSettings.windIntensity;
    windXInput.value = grassSettings.windX;
    windYInput.value = grassSettings.windY;
    planeColorInput.value = grassSettings.dirtColor;
    grassColor1Input.value = grassSettings.grassColor1;
    grassColor2Input.value = grassSettings.grassColor2;

    function updateGrassJSON() {
        const settings = {
            density: parseInt(grassDensityInput.value) || 0,
            minLength: parseFloat(bladeMinLengthInput.value) || 0,
            maxLength: parseFloat(bladeMaxLengthInput.value) || 0,
            minWidth: parseFloat(bladeMinWidthInput.value) || 0,
            maxWidth: parseFloat(bladeMaxWidthInput.value) || 0,
            minTipWidth: parseFloat(bladeMinTipWidthInput.value) || 0,
            maxTipWidth: parseFloat(bladeMaxTipWidthInput.value) || 0,
            segments: parseInt(bladeSegmentsInput.value) || 1,
            noiseScale: parseFloat(noiseScaleInput.value) || 0,
            windIntensity: parseFloat(windIntensityInput.value) || 0,
            windX: parseFloat(windXInput.value) || 0,
            windY: parseFloat(windYInput.value) || 0,
            dirtColor: planeColorInput.value,
            grassColor1: grassColor1Input.value,
            grassColor2: grassColor2Input.value
        };
        grassSettingsInput.value = JSON.stringify(settings, null, 2);
        localStorage.setItem('g_grassSettings', grassSettingsInput.value);
        
        if (gardenSystem) {
            gardenSystem.updateShader(settings);
        }
    }

    grassSettingsInput.addEventListener('input', () => {
        try {
            const settings = JSON.parse(grassSettingsInput.value);
            
            // Validate and Apply
            if (typeof settings.density === 'number') grassDensityInput.value = settings.density;
            if (typeof settings.minLength === 'number') bladeMinLengthInput.value = settings.minLength;
            if (typeof settings.maxLength === 'number') bladeMaxLengthInput.value = settings.maxLength;
            if (typeof settings.minWidth === 'number') bladeMinWidthInput.value = settings.minWidth;
            if (typeof settings.maxWidth === 'number') bladeMaxWidthInput.value = settings.maxWidth;
            if (typeof settings.minTipWidth === 'number') bladeMinTipWidthInput.value = settings.minTipWidth;
            if (typeof settings.maxTipWidth === 'number') bladeMaxTipWidthInput.value = settings.maxTipWidth;
            if (typeof settings.segments === 'number') bladeSegmentsInput.value = settings.segments;
            if (typeof settings.noiseScale === 'number') noiseScaleInput.value = settings.noiseScale;
            if (typeof settings.windIntensity === 'number') windIntensityInput.value = settings.windIntensity;
            if (typeof settings.windX === 'number') windXInput.value = settings.windX;
            if (typeof settings.windY === 'number') windYInput.value = settings.windY;
            if (settings.dirtColor) planeColorInput.value = settings.dirtColor;
            if (settings.grassColor1) grassColor1Input.value = settings.grassColor1;
            if (settings.grassColor2) grassColor2Input.value = settings.grassColor2;

            localStorage.setItem('g_grassSettings', grassSettingsInput.value);
            
            if (gardenSystem) {
                gardenSystem.updateShader(settings);
            }

        } catch (e) {
            // Ignore invalid JSON while typing
        }
    });

    prismWidthInput.value = getVal('prismWidth', '10');
    prismDepthInput.value = getVal('prismDepth', '5');
    prismSpacingInput.value = getVal('prismSpacing', '2');
    prismHeightsInput.value = getVal('prismHeights', '10, 6, 7');
    prngSeedInput.value = getVal('prngSeed', 'garden_seed_123');
    
    const defaultGardenSettings = {
        flowers: {
            density: 10,
            minScale: 4.8,
            maxScale: 6.5,
            yOffset: 2,
            randomRotation: true,
            rotationAxis: "y"
        },
        leaves: {
            density: 50,
            minScale: 0.3,
            maxScale: 0.5,
            yOffset: 4,
            randomRotation: true,
            xRot: [70, 120],
            yRot: [-45, 45],
            zRot: [0, 360]
        }
    };

    const defaultBlockSettings = {
        blockScaleSize: 4,
        overScaleDepth: 1.1,
        centerScaler: 1.666666667,
        uvScale: 0.2,
        reprojectUVs: true,
        blockHasSnailsOdds: 0.7,
        maxSnails: 2,
        minSnailScale: 3,
        maxSnailScale: 5,
        snailXOffset: 0,
        snailYOffset: -0.04,
        snailZOffset: -0.1,
        debugSnails: false,
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
    // DEBUG BLUE MATERIAL
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00ABAE, 
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
            gardenSystem.destroy();
            scene.remove(gardenSystem);
            gardenSystem = null;
        }

        let gSettings = {};
        let bSettings = {};
        let grSettings = {};
        try {
            gSettings = JSON.parse(gardenSettingsInput.value);
            bSettings = JSON.parse(blockSettingsInput.value);
            grSettings = JSON.parse(grassSettingsInput.value);
        } catch(e) {
            console.warn("Invalid JSON settings", e);
        }

        gardenSystem = new GardenSystem(
            loadedModels,
            ground,
            targetPrisms,
            gSettings,
            bSettings,
            grSettings,
            prngSeedInput.value
        );
        scene.add(gardenSystem);
        scene.updateMatrixWorld(true);
        updateButtonStates();
    }

    function destroyGarden() {
        if (gardenSystem) {
            gardenSystem.destroy();
            scene.remove(gardenSystem);
            gardenSystem = null;
            updateButtonStates();
        }
    }

    function updateButtonStates() {
        createGardenBtn.disabled = !!gardenSystem;
        destroyGardenBtn.disabled = !gardenSystem;
        
        createGardenBtn.style.opacity = createGardenBtn.disabled ? "0.5" : "1";
        destroyGardenBtn.style.opacity = destroyGardenBtn.disabled ? "0.5" : "1";
    }

    createGardenBtn.addEventListener('click', rebuildGarden);
    destroyGardenBtn.addEventListener('click', destroyGarden);

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
        if (gardenSystem) gardenSystem.initGrass();
    }, 0.1);

    setupDraggable(groundHeightInput, (v) => {
        ground.scale.y = v;
        setVal('groundHeight', v);
        if (gardenSystem) gardenSystem.initGrass();
    }, 0.1);

    setupDraggable(grassDensityInput, (v) => { updateGrassJSON(); }, 0);
    setupDraggable(bladeMinLengthInput, (v) => { updateGrassJSON(); }, 0);
    setupDraggable(bladeMaxLengthInput, (v) => { updateGrassJSON(); }, 0);
    setupDraggable(bladeMinWidthInput, (v) => { updateGrassJSON(); }, 0);
    setupDraggable(bladeMaxWidthInput, (v) => { updateGrassJSON(); }, 0);
    setupDraggable(bladeMinTipWidthInput, (v) => { updateGrassJSON(); }, 0);
    setupDraggable(bladeMaxTipWidthInput, (v) => { updateGrassJSON(); }, 0);
    setupDraggable(bladeSegmentsInput, (v) => { updateGrassJSON(); }, 1);
    
    setupDraggable(bendIntensityInput, (v) => { 
        if (gardenSystem && gardenSystem.grassMaterial) {
            gardenSystem.grassMaterial.uniforms.uBendIntensity.value = v; 
        }
        updateGrassJSON();
    });
    setupDraggable(noiseScaleInput, (v) => { 
        updateGrassJSON();
    });
    setupDraggable(windIntensityInput, (v) => { 
        updateGrassJSON();
    });
    setupDraggable(windXInput, (v) => { 
        updateGrassJSON();
    });
    setupDraggable(windYInput, (v) => { 
        updateGrassJSON();
    });
    
    planeColorInput.addEventListener('input', (e) => { 
        updateGrassJSON();
    });
    grassColor1Input.addEventListener('input', (e) => { 
        updateGrassJSON();
    });
    grassColor2Input.addEventListener('input', (e) => { 
        updateGrassJSON();
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
    if (gardenSystem) {
        gardenSystem.updateAnimation(time);
    }
    controls.update();
    renderer.render(scene, camera);
}

init();
