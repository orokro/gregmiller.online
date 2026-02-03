import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import BlockUnit from './BlockUnit.js';

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
let currentBlockUnit = null;

async function init() {
    const container = document.getElementById('canvas-container');
    const settingsInput = document.getElementById('settingsJson');
    const seedInput = document.getElementById('seed');
    const lengthInput = document.getElementById('blockLength');
    const widthInput = document.getElementById('blockWidth');
    const tallBlockInput = document.getElementById('tallBlock');
    const hdrInput = document.getElementById('hdrIntensity');
    const regenBtn = document.getElementById('regenerate');

    // Init Settings JSON
    let savedSettings = localStorage.getItem('blockunit_gen_settings');
    if (savedSettings) {
        settingsInput.value = savedSettings;
    } else {
        settingsInput.value = JSON.stringify(defaultBuildingSettings, null, 2);
    }

    // Load Persistence
    if (localStorage.getItem('bu_seed')) seedInput.value = localStorage.getItem('bu_seed');
    if (localStorage.getItem('bu_length')) lengthInput.value = localStorage.getItem('bu_length');
    if (localStorage.getItem('bu_width')) widthInput.value = localStorage.getItem('bu_width');
    if (localStorage.getItem('bu_hdr')) hdrInput.value = localStorage.getItem('bu_hdr');
    if (localStorage.getItem('bu_tall')) tallBlockInput.checked = localStorage.getItem('bu_tall') === 'true';

    // Three.js Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 500);
    camera.position.set(40, 40, 40);

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
    dirLight.position.set(20, 40, 20);
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
        localStorage.setItem('bu_hdr', e.target.value);
    });

    // Dynamic Resize Logic
    setupDraggableInput(lengthInput, (val) => {
        if (currentBlockUnit) currentBlockUnit.setLength(val);
        localStorage.setItem('bu_length', val);
    });
    setupDraggableInput(widthInput, (val) => {
        if (currentBlockUnit) currentBlockUnit.setWidth(val);
        localStorage.setItem('bu_width', val);
    });

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
    if (currentBlockUnit) {
        scene.remove(currentBlockUnit);
    }

    const seed = document.getElementById('seed').value;
    const length = parseFloat(document.getElementById('blockLength').value) || 10.0;
    const width = parseFloat(document.getElementById('blockWidth').value) || 6.56;
    const tallBlock = document.getElementById('tallBlock').checked;
    
    localStorage.setItem('bu_seed', seed);
    localStorage.setItem('bu_length', length);
    localStorage.setItem('bu_width', width);
    localStorage.setItem('bu_tall', tallBlock);

    let settings;
    try {
        settings = JSON.parse(document.getElementById('settingsJson').value);
        localStorage.setItem('blockunit_gen_settings', JSON.stringify(settings, null, 2));
    } catch (e) {
        alert("Invalid JSON settings");
        return;
    }

    currentBlockUnit = new BlockUnit(seed, glbAsset, tallBlock, length, width, settings);
    scene.add(currentBlockUnit);
}

function setupDraggableInput(input, onUpdate) {
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
        onUpdate(newVal);
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
        }
    });

    input.addEventListener('change', () => {
        onUpdate(parseFloat(input.value));
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
