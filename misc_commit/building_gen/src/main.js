import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Building from './Building.js';

// Default Settings
const defaultSettings = {
	height_scale: { min: 0.9, max: 1.2 },
	facade_colors: ["#FFB27D", "#b69c9cff", "#8f7a61ff", "#ffffffff"],
	cornice_colors: ["#e1a36bff", "#bec484ff", "#ffffffff"],
	roof_colors: ["#d8bfa9ff", "#cccebcff", "#b0b4c0ff", "#d1d1d1ff"],
	side_colors: ["#ebd3beff", "#bebeb6ff", "#b0b4c0ff", "#ffffffff"],
	fireescape_colors: ["#ffffffff", "#57c57cff"],
	awning_sat: {
		Box_Awning_01: 1, Box_Awning_02: 1, Box_Awning_03: 0.7, Box_Awning_04: 0.4,
	},
	tall_items: true,
	fireescape_odds: 0.4,
	window_ac_odds: 0.3,
	roof_item_scales: { min: 0.9, max: 1.2 }
};

// State
let scene, camera, renderer, controls;
let glbAsset = null;
let generatedBuildings = [];

async function init() {
    // Canvas & UI
    const container = document.getElementById('canvas-container');
    const settingsInput = document.getElementById('settingsJson');
    const seedInput = document.getElementById('seed');
    const blockSizeInput = document.getElementById('blockSize');
    const hdrInput = document.getElementById('hdrIntensity');
    const regenBtn = document.getElementById('regenerate');

    // Init Settings JSON
    let savedSettings = localStorage.getItem('building_gen_settings');
    if (savedSettings) {
        settingsInput.value = savedSettings;
    } else {
        settingsInput.value = JSON.stringify(defaultSettings, null, 2);
    }

    // Load Persistence for other inputs
    if (localStorage.getItem('bg_seed')) seedInput.value = localStorage.getItem('bg_seed');
    if (localStorage.getItem('bg_blockSize')) blockSizeInput.value = localStorage.getItem('bg_blockSize');
    if (localStorage.getItem('bg_spacing')) {
        document.getElementById('spacing').value = localStorage.getItem('bg_spacing');
    } else {
        document.getElementById('spacing').value = "2.0"; // Default
    }
    if (localStorage.getItem('bg_hdr')) {
        hdrInput.value = localStorage.getItem('bg_hdr');
    }

    // Three.js Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(20, 20, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 5, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Load Assets
    try {
        await loadAssets();
    } catch (e) {
        console.error("Failed to load assets", e);
        alert("Failed to load assets: " + e.message);
        return;
    }

    // Setup UI Events
    regenBtn.addEventListener('click', regenerate);
    hdrInput.addEventListener('input', (e) => {
        renderer.toneMappingExposure = parseFloat(e.target.value);
    });

    window.addEventListener('resize', onWindowResize);

    // Initial Generation
    regenerate();

    // Loop
    animate();
}

async function loadAssets() {
    // Load HDR
    const rgbeLoader = new RGBELoader();
    const texture = await rgbeLoader.loadAsync('env.hdr');
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    // scene.background = texture; // Optional: keep solid color background for clarity

    // Load GLB
    const gltfLoader = new GLTFLoader();
    glbAsset = await gltfLoader.loadAsync('City_v001.glb');
}

function regenerate() {
    // Clear existing
    generatedBuildings.forEach(b => scene.remove(b));
    generatedBuildings = [];

    // Get Settings
    const seed = document.getElementById('seed').value;
    const blockSize = parseInt(document.getElementById('blockSize').value) || 1;
    const spacing = parseFloat(document.getElementById('spacing').value) || 2.0;
    const hdrVal = document.getElementById('hdrIntensity').value;

    // Save Persistence
    localStorage.setItem('bg_seed', seed);
    localStorage.setItem('bg_blockSize', blockSize);
    localStorage.setItem('bg_spacing', spacing);
    localStorage.setItem('bg_hdr', hdrVal);

    let settings;
    try {
        settings = JSON.parse(document.getElementById('settingsJson').value);
        localStorage.setItem('building_gen_settings', JSON.stringify(settings, null, 2));
    } catch (e) {
        alert("Invalid JSON settings");
        return;
    }

    // Generate Blocks
    // Simple line for now
    const startX = -((blockSize - 1) * spacing) / 2;

    for (let i = 0; i < blockSize; i++) {
        // Deterministic seed variation per building
        const buildingSeed = seed + "_" + i;
        const building = new Building(glbAsset, settings, buildingSeed);
        
        building.position.x = startX + (i * spacing);
        scene.add(building);
        generatedBuildings.push(building);
    }
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();
