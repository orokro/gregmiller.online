import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Block from './Block.js';

// Default Building Settings
const defaultBuildingSettings = {
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
let currentBlock = null;

async function init() {
    const container = document.getElementById('canvas-container');
    const settingsInput = document.getElementById('settingsJson');
    const seedInput = document.getElementById('seed');
    const blockSizeInput = document.getElementById('blockSize');
    const tallBlockInput = document.getElementById('tallBlock');
    const hdrInput = document.getElementById('hdrIntensity');
    const regenBtn = document.getElementById('regenerate');

    // Init Settings JSON
    let savedSettings = localStorage.getItem('block_gen_settings');
    if (savedSettings) {
        settingsInput.value = savedSettings;
    } else {
        settingsInput.value = JSON.stringify(defaultBuildingSettings, null, 2);
    }

    // Load Persistence
    if (localStorage.getItem('block_seed')) seedInput.value = localStorage.getItem('block_seed');
    if (localStorage.getItem('block_size')) blockSizeInput.value = localStorage.getItem('block_size');
    if (localStorage.getItem('block_hdr')) hdrInput.value = localStorage.getItem('block_hdr');
    if (localStorage.getItem('block_tall')) tallBlockInput.checked = localStorage.getItem('block_tall') === 'true';

    // Three.js Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
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
        return;
    }

    // Setup UI Events
    regenBtn.addEventListener('click', regenerate);
    hdrInput.addEventListener('input', (e) => {
        renderer.toneMappingExposure = parseFloat(e.target.value);
        localStorage.setItem('block_hdr', e.target.value);
    });

    // Dynamic Resize Logic
    setupBlockSizeDrag(blockSizeInput);

    window.addEventListener('resize', onWindowResize);

    // Initial Generation
    regenerate();

    animate();
}

async function loadAssets() {
    const rgbeLoader = new RGBELoader();
    const texture = await rgbeLoader.loadAsync('env.hdr');
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;

    const gltfLoader = new GLTFLoader();
    glbAsset = await gltfLoader.loadAsync('City_v001.glb');
}

function regenerate() {
    if (currentBlock) {
        scene.remove(currentBlock);
    }

    const seed = document.getElementById('seed').value;
    const blockSize = parseFloat(document.getElementById('blockSize').value) || 5.0;
    const tallBlock = document.getElementById('tallBlock').checked;
    
    localStorage.setItem('block_seed', seed);
    localStorage.setItem('block_size', blockSize);
    localStorage.setItem('block_tall', tallBlock);

    let settings;
    try {
        settings = JSON.parse(document.getElementById('settingsJson').value);
        localStorage.setItem('block_gen_settings', JSON.stringify(settings, null, 2));
    } catch (e) {
        alert("Invalid JSON settings");
        return;
    }

    currentBlock = new Block(seed, glbAsset, tallBlock, blockSize, settings);
    scene.add(currentBlock);
}

function setupBlockSizeDrag(input) {
    let isDragging = false;
    let startX = 0;
    let startVal = 0;

    input.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startVal = parseFloat(input.value);
        document.body.style.cursor = 'ew-resize';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const delta = e.clientX - startX;
        const speed = e.shiftKey ? 0.01 : 0.1;
        let newVal = startVal + (delta * speed);
        newVal = Math.max(0.5, Math.round(newVal * 100) / 100);
        
        input.value = newVal;
        if (currentBlock) {
            currentBlock.setBlockSize(newVal);
            localStorage.setItem('block_size', newVal);
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
        }
    });

    // Also handle direct input change
    input.addEventListener('change', () => {
        const val = parseFloat(input.value);
        if (currentBlock) {
            currentBlock.setBlockSize(val);
            localStorage.setItem('block_size', val);
        }
    });
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
