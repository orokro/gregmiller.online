import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import BlockRow from './BlockRow.js';

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

const defaultRowSettings = {
    roadMinWidth: 1.0,
    roadMaxWidth: 1.5,
    maxEdgeScale: 1.5,
    unitsPerBuilding: 2.5
};

// State
let scene, camera, renderer, controls;
let glbAsset = null;
let currentBlockRow = null;
let roadMaterial = null;

// Target Objects
let targetPrism, targetFloor;

async function init() {
    const container = document.getElementById('canvas-container');
    
    // UI Elements
    const seedInput = document.getElementById('seed');
    const prismWInput = document.getElementById('prismW');
    const prismHInput = document.getElementById('prismH');
    const prismLInput = document.getElementById('prismL');
    const floorWInput = document.getElementById('floorW');
    const upbInput = document.getElementById('unitsPerBuilding');
    const wireframeCheck = document.getElementById('wireframe');
    const regenBtn = document.getElementById('regenerate');

    // Persistence
    if (localStorage.getItem('br_seed')) seedInput.value = localStorage.getItem('br_seed');
    if (localStorage.getItem('br_prismW')) prismWInput.value = localStorage.getItem('br_prismW');
    if (localStorage.getItem('br_prismH')) prismHInput.value = localStorage.getItem('br_prismH');
    if (localStorage.getItem('br_prismL')) prismLInput.value = localStorage.getItem('br_prismL');
    if (localStorage.getItem('br_floorW')) floorWInput.value = localStorage.getItem('br_floorW');
    if (localStorage.getItem('br_upb')) upbInput.value = localStorage.getItem('br_upb');

    // Three.js Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(60, 60, 60);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    // Initial Prism and Floor
    targetPrism = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.2 })
    );
    scene.add(targetPrism);

    targetFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    targetFloor.rotation.x = -Math.PI / 2;
    scene.add(targetFloor);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(50, 100, 50);
    scene.add(dirLight);

    // Load Assets
    try {
        await loadAssets();
    } catch (e) {
        console.error("Failed to load assets", e);
        return;
    }

    // Road Material
    const textureLoader = new THREE.TextureLoader();
    const roadTex = textureLoader.load('https://threejs.org/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg'); // Placeholder
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    roadMaterial = new THREE.MeshStandardMaterial({ map: roadTex });

    // Events
    regenBtn.addEventListener('click', regenerate);
    wireframeCheck.addEventListener('change', (e) => {
        targetPrism.visible = e.target.checked;
        targetFloor.visible = e.target.checked;
    });

    setupDraggable(prismWInput, (v) => {
        targetPrism.scale.x = v;
        localStorage.setItem('br_prismW', v);
        if (currentBlockRow) currentBlockRow.updateLayout();
    });
    setupDraggable(prismHInput, (v) => {
        targetPrism.scale.y = v;
        targetPrism.position.y = v / 2;
        localStorage.setItem('br_prismH', v);
        if (currentBlockRow) currentBlockRow.updateLayout();
    });
    setupDraggable(prismLInput, (v) => {
        targetPrism.scale.z = v;
        targetFloor.scale.y = v; // "plane height should always match the block length"
        localStorage.setItem('br_prismL', v);
        if (currentBlockRow) currentBlockRow.updateLayout();
    });
    setupDraggable(floorWInput, (v) => {
        targetFloor.scale.x = v;
        localStorage.setItem('br_floorW', v);
        if (currentBlockRow) currentBlockRow.updateLayout();
    });
    setupDraggable(upbInput, (v) => {
        localStorage.setItem('br_upb', v);
        // UPB requires re-init of BlockRow because it affects building counts
        regenerate();
    });

    // Sync initial sizes
    targetPrism.scale.set(parseFloat(prismWInput.value), parseFloat(prismHInput.value), parseFloat(prismLInput.value));
    targetPrism.position.y = targetPrism.scale.y / 2;
    targetFloor.scale.set(parseFloat(floorWInput.value), targetPrism.scale.z, 1);

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
    if (currentBlockRow) scene.remove(currentBlockRow);

    const seed = document.getElementById('seed').value;
    const upb = parseFloat(document.getElementById('unitsPerBuilding').value) || 2.5;
    
    currentBlockRow = new BlockRow(
        targetPrism,
        targetFloor,
        upb,
        roadMaterial,
        seed,
        glbAsset,
        defaultRowSettings,
        defaultBuildingSettings
    );
    scene.add(currentBlockRow);
}

function setupDraggable(input, onUpdate) {
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
        let newVal = Math.max(0.1, Math.round((startVal + delta * speed) * 100) / 100);
        input.value = newVal;
        onUpdate(newVal);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = 'default';
    });

    input.addEventListener('change', () => onUpdate(parseFloat(input.value)));
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
