import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import CityGrid from './CityGrid.js';

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
    awning_value: 0.5,
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
let currentCityGrid = null;
let roadMaterial = null;
let roadIntersectionMaterial = null;
let roadSideMaterial = null;

// Target Objects
let targetPrisms = [];
let targetFloor;

async function loadAssets() {
    const rgbeLoader = new RGBELoader();
    const texture = await rgbeLoader.loadAsync('env.hdr');
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;

    const gltfLoader = new GLTFLoader();
    glbAsset = await gltfLoader.loadAsync('City_v001.glb');
}

async function init() {
    const container = document.getElementById('canvas-container');
    
    // UI Elements
    const seedInput = document.getElementById('seed');
    const floorXInput = document.getElementById('floorX');
    const floorYInput = document.getElementById('floorY');
    const floorZInput = document.getElementById('floorZ');
    const floorWInput = document.getElementById('floorW');
    const floorLInput = document.getElementById('floorL');
    
    const prismWInput = document.getElementById('prismW');
    const prismHInput = document.getElementById('prismH');
    const prismsCSVInput = document.getElementById('prisms');
    const prismSpacingInput = document.getElementById('prismSpacing');
    const maxCapScaleInput = document.getElementById('maxCapScale');
    
    const upbInput = document.getElementById('unitsPerBuilding');
    const rowSettingsInput = document.getElementById('rowSettingsJson');
    const buildingSettingsInput = document.getElementById('buildingSettingsJson');
    const wireframeCheck = document.getElementById('wireframe');
    const regenBtn = document.getElementById('regenerate');

    // Persistence
    if (localStorage.getItem('cg_seed')) seedInput.value = localStorage.getItem('cg_seed');
    if (localStorage.getItem('cg_floorX')) floorXInput.value = localStorage.getItem('cg_floorX');
    if (localStorage.getItem('cg_floorY')) floorYInput.value = localStorage.getItem('cg_floorY');
    if (localStorage.getItem('cg_floorZ')) floorZInput.value = localStorage.getItem('cg_floorZ');
    if (localStorage.getItem('cg_floorW')) floorWInput.value = localStorage.getItem('cg_floorW');
    if (localStorage.getItem('cg_floorL')) floorLInput.value = localStorage.getItem('cg_floorL');
    
    if (localStorage.getItem('cg_prismW')) prismWInput.value = localStorage.getItem('cg_prismW');
    if (localStorage.getItem('cg_prismH')) prismHInput.value = localStorage.getItem('cg_prismH');
    if (localStorage.getItem('cg_prisms')) prismsCSVInput.value = localStorage.getItem('cg_prisms');
    if (localStorage.getItem('cg_prismSpacing')) prismSpacingInput.value = localStorage.getItem('cg_prismSpacing');
    if (localStorage.getItem('cg_maxCapScale')) maxCapScaleInput.value = localStorage.getItem('cg_maxCapScale');
    
    if (localStorage.getItem('cg_upb')) upbInput.value = localStorage.getItem('cg_upb');
    
    if (localStorage.getItem('cg_rowSettings')) {
        rowSettingsInput.value = localStorage.getItem('cg_rowSettings');
    } else {
        rowSettingsInput.value = JSON.stringify(defaultRowSettings, null, 2);
    }

    if (localStorage.getItem('cg_buildingSettings')) {
        buildingSettingsInput.value = localStorage.getItem('cg_buildingSettings');
    } else {
        buildingSettingsInput.value = JSON.stringify(defaultBuildingSettings, null, 2);
    }

    // Three.js Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(100, 100, 100);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    // Initial Floor
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

    // Road Materials
    const textureLoader = new THREE.TextureLoader();
    const roadTex = textureLoader.load('tex/road.jpg'); 
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    roadMaterial = new THREE.MeshStandardMaterial({ map: roadTex });

    const intersectionTex = textureLoader.load('tex/intersection.jpg');
    intersectionTex.wrapS = intersectionTex.wrapT = THREE.RepeatWrapping;
    roadIntersectionMaterial = roadMaterial.clone();
    roadIntersectionMaterial.map = intersectionTex;

    const roadSideTex = textureLoader.load('tex/road_side.jpg');
    roadSideTex.wrapS = roadSideTex.wrapT = THREE.RepeatWrapping;
    roadSideMaterial = roadMaterial.clone();
    roadSideMaterial.map = roadSideTex;

    // Events
    regenBtn.addEventListener('click', regenerate);
    wireframeCheck.addEventListener('change', (e) => {
        targetFloor.material.visible = e.target.checked;
        targetPrisms.forEach(p => p.material.visible = e.target.checked);
    });

    setupDraggable(floorXInput, (v) => {
        targetFloor.position.x = v;
        localStorage.setItem('cg_floorX', v);
        if (currentCityGrid) currentCityGrid.update();
    });
    setupDraggable(floorYInput, (v) => {
        targetFloor.position.y = v;
        localStorage.setItem('cg_floorY', v);
        if (currentCityGrid) currentCityGrid.update();
    });
    setupDraggable(floorZInput, (v) => {
        targetFloor.position.z = v;
        localStorage.setItem('cg_floorZ', v);
        if (currentCityGrid) currentCityGrid.update();
    });
    setupDraggable(floorWInput, (v) => {
        targetFloor.scale.x = v;
        localStorage.setItem('cg_floorW', v);
        if (currentCityGrid) currentCityGrid.update();
    }, 0.1);
    setupDraggable(floorLInput, (v) => {
        targetFloor.scale.y = v; // Y scale on a plane is Z in world
        localStorage.setItem('cg_floorL', v);
        if (currentCityGrid) currentCityGrid.update();
    }, 0.1);

    setupDraggable(prismWInput, (v) => {
        targetPrisms.forEach(p => p.scale.x = v);
        localStorage.setItem('cg_prismW', v);
        if (currentCityGrid) currentCityGrid.update();
    }, 0.1);

    setupDraggable(prismHInput, (v) => {
        targetPrisms.forEach(p => {
            p.scale.y = v;
            p.position.y = v / 2;
        });
        localStorage.setItem('cg_prismH', v);
        if (currentCityGrid) currentCityGrid.update();
    }, 0.1);

    setupDraggable(prismSpacingInput, (v) => {
        localStorage.setItem('cg_prismSpacing', v);
        updatePrismPositions();
        if (currentCityGrid) currentCityGrid.setPrismSpacing(v);
    });

    setupDraggable(maxCapScaleInput, (v) => {
        localStorage.setItem('cg_maxCapScale', v);
        if (currentCityGrid) {
            currentCityGrid.rowConfig.maxCapScale = v;
            currentCityGrid.update();
        }
    }, 0.1);

    setupDraggable(upbInput, (v) => {
        localStorage.setItem('cg_upb', v);
        if (currentCityGrid) currentCityGrid.setUnitsPerBuilding(v);
    }, 0.1);

    // Sync initial sizes
    targetFloor.position.set(parseFloat(floorXInput.value), parseFloat(floorYInput.value), parseFloat(floorZInput.value));
    targetFloor.scale.set(parseFloat(floorWInput.value), parseFloat(floorLInput.value), 1);

    regenerate();
    animate();

    function regenerate() {
        if (currentCityGrid) scene.remove(currentCityGrid);
        targetPrisms.forEach(p => scene.remove(p));
        targetPrisms = [];
    
        const seed = document.getElementById('seed').value;
        const upb = parseFloat(document.getElementById('unitsPerBuilding').value) || 2.5;
        const wireframe = document.getElementById('wireframe').checked;
        
        const prismW = parseFloat(document.getElementById('prismW').value) || 10;
        const prismH = parseFloat(document.getElementById('prismH').value) || 5;
        const prismsCSV = document.getElementById('prisms').value;
        const spacing = parseFloat(document.getElementById('prismSpacing').value) || 5;
        const maxCapScale = parseFloat(document.getElementById('maxCapScale').value) || 1.5;
    
        // Save
        localStorage.setItem('cg_seed', seed);
        localStorage.setItem('cg_upb', upb);
        localStorage.setItem('cg_prismW', prismW);
        localStorage.setItem('cg_prismH', prismH);
        localStorage.setItem('cg_prisms', prismsCSV);
        localStorage.setItem('cg_prismSpacing', spacing);
        localStorage.setItem('cg_maxCapScale', maxCapScale);
    
        // Create Prisms
        const zSizes = prismsCSV.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const totalZLength = zSizes.reduce((a, b) => a + b, 0) + (zSizes.length - 1) * spacing;
        let currentZ = -totalZLength / 2;
    
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.2, visible: wireframe });
    
        zSizes.forEach((zSize, i) => {
            const prism = new THREE.Mesh(geom, mat);
            prism.scale.set(prismW, prismH, zSize);
            prism.position.set(0, prismH / 2, currentZ + zSize / 2);
            scene.add(prism);
            targetPrisms.push(prism);
            currentZ += zSize + spacing;
        });
    
        let rowSettings;
        try {
            rowSettings = JSON.parse(document.getElementById('rowSettingsJson').value);
            localStorage.setItem('cg_rowSettings', JSON.stringify(rowSettings, null, 2));
        } catch (e) {
            rowSettings = defaultRowSettings;
        }

        // Merge Cap Max Scale
        rowSettings.maxCapScale = maxCapScale;
    
        let buildingSettings;
        try {
            buildingSettings = JSON.parse(document.getElementById('buildingSettingsJson').value);
            localStorage.setItem('cg_buildingSettings', JSON.stringify(buildingSettings, null, 2));
        } catch (e) {
            buildingSettings = defaultBuildingSettings;
        }
    
        currentCityGrid = new CityGrid(
            seed,
            glbAsset,
            roadMaterial,
            roadIntersectionMaterial,
            roadSideMaterial,
            targetFloor,
            targetPrisms,
            upb,
            rowSettings,
            buildingSettings
        );
        currentCityGrid.setPrismSpacing(spacing);
        scene.add(currentCityGrid);
    }
}

function updatePrismPositions() {
    const spacing = parseFloat(document.getElementById('prismSpacing').value) || 5;
    const zSizes = targetPrisms.map(p => p.scale.z);
    const totalZLength = zSizes.reduce((a, b) => a + b, 0) + (zSizes.length - 1) * spacing;
    let currentZ = -totalZLength / 2;

    targetPrisms.forEach((prism, i) => {
        const zSize = zSizes[i];
        prism.position.z = currentZ + zSize / 2;
        currentZ += zSize + spacing;
    });
}

function setupDraggable(input, onUpdate, minVal = null) {
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
        let newVal = Math.round((startVal + delta * speed) * 100) / 100;
        if (minVal !== null) newVal = Math.max(minVal, newVal);
        input.value = newVal;
        onUpdate(newVal);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = 'default';
    });

    input.addEventListener('input', () => onUpdate(parseFloat(input.value)));
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();