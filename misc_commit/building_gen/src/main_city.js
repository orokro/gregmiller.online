import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import City from './City.js';

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
    unitsPerBuilding: 2.5,
    street_light_spacing: 5.0
};

// State
let scene, camera, renderer, controls;
let glbAsset = null;
let signalAsset = null;
let streetLightAsset = null;
let currentCity = null;
let roadMaterial = null;
let roadIntersectionMaterial = null;
let roadSideMaterial = null;

// Target Objects (Z-Up Environment)
let targetPrisms = [];
let targetFloor;

async function loadAssets() {
    const rgbeLoader = new RGBELoader();
    const texture = await rgbeLoader.loadAsync('env.hdr');
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;

    const gltfLoader = new GLTFLoader();
    glbAsset = await gltfLoader.loadAsync('models/City_v001.glb');
    signalAsset = await gltfLoader.loadAsync('models/Signal.glb');
    streetLightAsset = await gltfLoader.loadAsync('models/Street_Light.glb');
}

async function init() {
    const container = document.getElementById('canvas-container');
    
    // UI Elements
    const seedInput = document.getElementById('seed');
    // Floor (Z-Up: X=Width, Y=Depth)
    const floorXInput = document.getElementById('floorX');
    const floorYInput = document.getElementById('floorY'); // Depth Pos
    const floorWInput = document.getElementById('floorW'); // X Size
    const floorHInput = document.getElementById('floorH'); // Y Size (Depth Size)
    
    const prismWInput = document.getElementById('prismW');
    const prismDInput = document.getElementById('prismD'); // Z Size (Height) -> Wait, prompt says "Prisms Depth (Z - Height)"? 
    // Usually Z is Height in Z-up. "Prism Depth (Z - Height)" label implies input controls Height (Z). 
    // And "Prisms (Y sizes CSV)" implies the CSV controls spacing along Y (Depth).
    // Let's assume prismDInput controls the Prism's Z-scale (Height).
    
    const prismsCSVInput = document.getElementById('prisms'); // Y sizes
    const prismSpacingInput = document.getElementById('prismSpacing');
    const maxCapScaleInput = document.getElementById('maxCapScale');
    const lightSpacingInput = document.getElementById('lightSpacing');
    
    const upbInput = document.getElementById('unitsPerBuilding');
    const rowSettingsInput = document.getElementById('rowSettingsJson');
    const buildingSettingsInput = document.getElementById('buildingSettingsJson');
    const wireframeCheck = document.getElementById('wireframe');
    const regenBtn = document.getElementById('regenerate');

    // Persistence (Reuse cg_ keys or new c_ keys? New to avoid conflict)
    const getVal = (key, def) => localStorage.getItem('c_' + key) || def;
    const setVal = (key, val) => localStorage.setItem('c_' + key, val);

    if (getVal('seed')) seedInput.value = getVal('seed');
    if (getVal('floorX')) floorXInput.value = getVal('floorX');
    if (getVal('floorY')) floorYInput.value = getVal('floorY');
    if (getVal('floorW')) floorWInput.value = getVal('floorW');
    if (getVal('floorH')) floorHInput.value = getVal('floorH');
    
    if (getVal('prismW')) prismWInput.value = getVal('prismW');
    if (getVal('prismD')) prismDInput.value = getVal('prismD');
    if (getVal('prisms')) prismsCSVInput.value = getVal('prisms');
    if (getVal('prismSpacing')) prismSpacingInput.value = getVal('prismSpacing');
    if (getVal('maxCapScale')) maxCapScaleInput.value = getVal('maxCapScale');
    if (getVal('lightSpacing')) lightSpacingInput.value = getVal('lightSpacing');
    
    if (getVal('upb')) upbInput.value = getVal('upb');
    
    if (getVal('rowSettings')) rowSettingsInput.value = getVal('rowSettings');
    else rowSettingsInput.value = JSON.stringify(defaultRowSettings, null, 2);

    if (getVal('buildingSettings')) buildingSettingsInput.value = getVal('buildingSettings');
    else buildingSettingsInput.value = JSON.stringify(defaultBuildingSettings, null, 2);

    // Three.js Setup (Z-Up Camera)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    // Camera looking down/forward in Z-up world
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.up.set(0, 0, 1); // Z is UP
    camera.position.set(100, -100, 100); // Back and Up
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    // Initial Floor (Z-Up: XY Plane)
    targetFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    // No rotation needed for XY plane
    scene.add(targetFloor);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(50, -50, 100); // Adjusted for Z-up
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

    // Floor Draggables
    setupDraggable(floorXInput, (v) => {
        targetFloor.position.x = v;
        setVal('floorX', v);
        if (currentCity) currentCity.update();
    });
    setupDraggable(floorYInput, (v) => {
        targetFloor.position.y = v; // Y is Depth pos
        setVal('floorY', v);
        if (currentCity) currentCity.update();
    });
    setupDraggable(floorWInput, (v) => {
        targetFloor.scale.x = v;
        setVal('floorW', v);
        if (currentCity) currentCity.update();
    }, 0.1);
    setupDraggable(floorHInput, (v) => {
        targetFloor.scale.y = v; // Y scale is Depth size
        setVal('floorH', v);
        if (currentCity) currentCity.update();
    }, 0.1);

    // Prism Draggables
    setupDraggable(prismWInput, (v) => {
        targetPrisms.forEach(p => p.scale.x = v);
        setVal('prismW', v);
        if (currentCity) currentCity.update();
    }, 0.1);

    setupDraggable(prismDInput, (v) => { // Controls Z Scale (Height)
        targetPrisms.forEach(p => {
            p.scale.z = v;
            p.position.z = v / 2; // Sit on ground (Z=0)
        });
        setVal('prismD', v);
        if (currentCity) currentCity.update();
    }, 0.1);

    setupDraggable(prismSpacingInput, (v) => {
        setVal('prismSpacing', v);
        updatePrismPositions();
        if (currentCity) {
            // City doesn't expose setPrismSpacing directly, need to route via update or settings?
            // City.update() handles position changes.
            // But CityGrid needs spacing for SideRoads.
            // CityGrid gets spacing from setPrismSpacing.
            // We need to pass this down.
            // Ideally City.update() should handle it, but spacing is a setting.
            // Let's rely on regenerate for settings changes? 
            // Or access internal grid? 
            // currentCity.cityGrid.setPrismSpacing(v);
            if (currentCity.cityGrid) currentCity.cityGrid.setPrismSpacing(v);
            currentCity.update();
        }
    });

    setupDraggable(maxCapScaleInput, (v) => {
        setVal('maxCapScale', v);
        if (currentCity) {
            currentCity.cityGrid.rowConfig.maxCapScale = v;
            currentCity.cityGrid.update();
        }
    }, 0.1);

    setupDraggable(lightSpacingInput, (v) => {
        setVal('lightSpacing', v);
        if (currentCity) {
            currentCity.cityGrid.rowConfig.street_light_spacing = v;
            currentCity.cityGrid.update();
        }
    }, 0.1);

    setupDraggable(upbInput, (v) => {
        setVal('upb', v);
        if (currentCity) currentCity.cityGrid.setUnitsPerBuilding(v);
    }, 0.1);

    // Sync initial sizes
    targetFloor.position.set(parseFloat(floorXInput.value), parseFloat(floorYInput.value), 0);
    targetFloor.scale.set(parseFloat(floorWInput.value), parseFloat(floorHInput.value), 1);

    regenerate();
    animate();

    function regenerate() {
        if (currentCity) scene.remove(currentCity);
        targetPrisms.forEach(p => scene.remove(p));
        targetPrisms = [];
    
        const seed = document.getElementById('seed').value;
        const upb = parseFloat(document.getElementById('unitsPerBuilding').value) || 2.5;
        const wireframe = document.getElementById('wireframe').checked;
        
        const prismW = parseFloat(document.getElementById('prismW').value) || 10;
        const prismHeight = parseFloat(document.getElementById('prismD').value) || 5; // Z Size
        const prismsCSV = document.getElementById('prisms').value;
        const spacing = parseFloat(document.getElementById('prismSpacing').value) || 5;
        const maxCapScale = parseFloat(document.getElementById('maxCapScale').value) || 1.5;
        const lightSpacing = parseFloat(document.getElementById('lightSpacing').value) || 5.0;
    
        // Save
        setVal('seed', seed);
        setVal('upb', upb);
        setVal('prismW', prismW);
        setVal('prismD', prismHeight);
        setVal('prisms', prismsCSV);
        setVal('prismSpacing', spacing);
        setVal('maxCapScale', maxCapScale);
        setVal('lightSpacing', lightSpacing);
    
        // Create Prisms (Z-Up, Y-Depth Layout)
        // Sizes in CSV are Y-lengths (Depth)
        const ySizes = prismsCSV.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const totalYLength = ySizes.reduce((a, b) => a + b, 0) + (ySizes.length - 1) * spacing;
        let currentY = -totalYLength / 2;
    
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.2, visible: wireframe });
    
        ySizes.forEach((ySize, i) => {
            const prism = new THREE.Mesh(geom, mat);
            // Scale: X=Width, Y=Depth (from CSV), Z=Height (from Input)
            prism.scale.set(prismW, ySize, prismHeight);
            // Pos: X=0, Y=Accumulated, Z=Height/2 (Sitting on floor)
            prism.position.set(0, currentY + ySize / 2, prismHeight / 2);
            scene.add(prism);
            targetPrisms.push(prism);
            currentY += ySize + spacing;
        });
    
        let rowSettings;
        try {
            rowSettings = JSON.parse(document.getElementById('rowSettingsJson').value);
            setVal('rowSettings', JSON.stringify(rowSettings, null, 2));
        } catch (e) {
            rowSettings = defaultRowSettings;
        }

        // Merge Cap Max Scale & Light Spacing
        rowSettings.maxCapScale = maxCapScale;
        rowSettings.street_light_spacing = lightSpacing;
    
        let buildingSettings;
        try {
            buildingSettings = JSON.parse(document.getElementById('buildingSettingsJson').value);
            setVal('buildingSettings', JSON.stringify(buildingSettings, null, 2));
        } catch (e) {
            buildingSettings = defaultBuildingSettings;
        }
    
        currentCity = new City(
            seed,
            glbAsset,
            signalAsset,
            streetLightAsset,
            roadMaterial,
            roadIntersectionMaterial,
            roadSideMaterial,
            targetFloor,
            targetPrisms,
            upb,
            rowSettings,
            buildingSettings
        );
        currentCity.cityGrid.setPrismSpacing(spacing);
        scene.add(currentCity);
    }
}

function updatePrismPositions() {
    const spacing = parseFloat(document.getElementById('prismSpacing').value) || 5;
    const ySizes = targetPrisms.map(p => p.scale.y);
    const totalYLength = ySizes.reduce((a, b) => a + b, 0) + (ySizes.length - 1) * spacing;
    let currentY = -totalYLength / 2;

    targetPrisms.forEach((prism, i) => {
        const ySize = ySizes[i];
        prism.position.y = currentY + ySize / 2;
        currentY += ySize + spacing;
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
