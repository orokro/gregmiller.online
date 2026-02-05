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
let carAsset = null;
let currentCity = null;
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
    glbAsset = await gltfLoader.loadAsync('models/City_v001.glb');
    signalAsset = await gltfLoader.loadAsync('models/Signal.glb');
    streetLightAsset = await gltfLoader.loadAsync('models/Street_Light.glb');
    carAsset = await gltfLoader.loadAsync('models/Cars_Library.glb');
}

async function init() {
    const container = document.getElementById('canvas-container');
    
    // UI Elements
    const seedInput = document.getElementById('seed');
    const floorXInput = document.getElementById('floorX');
    const floorYInput = document.getElementById('floorY');
    const floorWInput = document.getElementById('floorW');
    const floorHInput = document.getElementById('floorH');
    
    const prismWInput = document.getElementById('prismW');
    const prismHInput = document.getElementById('prismD');
    const prismsCSVInput = document.getElementById('prisms');
    const prismSpacingInput = document.getElementById('prismSpacing');
    const maxCapScaleInput = document.getElementById('maxCapScale');
    const lightSpacingInput = document.getElementById('lightSpacing');
    
    const maxCarsInput = document.getElementById('maxCars');
    const carSizeInput = document.getElementById('carSize');
    const showTrafficLogsInput = document.getElementById('showTrafficLogs');
    
    const upbInput = document.getElementById('unitsPerBuilding');
    const rowSettingsInput = document.getElementById('rowSettingsJson');
    const buildingSettingsInput = document.getElementById('buildingSettingsJson');
    const wireframeCheck = document.getElementById('wireframe');
    const regenBtn = document.getElementById('regenerate');

    // Persistence
    const getVal = (key, def) => localStorage.getItem('c_' + key) || def;
    const setVal = (key, val) => localStorage.setItem('c_' + key, val);

    if (getVal('seed')) seedInput.value = getVal('seed');
    if (getVal('floorX')) floorXInput.value = getVal('floorX');
    if (getVal('floorY')) floorYInput.value = getVal('floorY');
    if (getVal('floorW')) floorWInput.value = getVal('floorW');
    if (getVal('floorH')) floorHInput.value = getVal('floorH');
    
    if (getVal('prismW')) prismWInput.value = getVal('prismW');
    if (getVal('prismD')) prismHInput.value = getVal('prismD');
    if (getVal('prisms')) prismsCSVInput.value = getVal('prisms');
    if (getVal('prismSpacing')) prismSpacingInput.value = getVal('prismSpacing');
    if (getVal('maxCapScale')) maxCapScaleInput.value = getVal('maxCapScale');
    if (getVal('lightSpacing')) lightSpacingInput.value = getVal('lightSpacing');
    
    if (getVal('maxCars')) maxCarsInput.value = getVal('maxCars');
    if (getVal('carSize')) carSizeInput.value = getVal('carSize');
    if (getVal('showTrafficLogs')) showTrafficLogsInput.checked = getVal('showTrafficLogs') === 'true';
    
    if (getVal('upb')) upbInput.value = getVal('upb');
    
    if (getVal('rowSettings')) rowSettingsInput.value = getVal('rowSettings');
    else rowSettingsInput.value = JSON.stringify(defaultRowSettings, null, 2);

    if (getVal('buildingSettings')) buildingSettingsInput.value = getVal('buildingSettings');
    else buildingSettingsInput.value = JSON.stringify(defaultBuildingSettings, null, 2);

    // Three.js Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.up.set(0, 0, 1); 
    camera.position.set(100, -100, 100); 
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

    targetFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: true, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    );
    scene.add(targetFloor);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(50, -50, 100);
    scene.add(dirLight);

    try {
        await loadAssets();
    } catch (e) {
        console.error("Failed to load assets", e);
        return;
    }

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

    regenBtn.addEventListener('click', regenerate);
    wireframeCheck.addEventListener('change', (e) => {
        targetFloor.material.visible = e.target.checked;
        targetPrisms.forEach(p => p.material.visible = e.target.checked);
    });

    setupDraggable(floorXInput, (v) => {
        targetFloor.position.x = v;
        setVal('floorX', v);
        if (currentCity) currentCity.update();
    });
    setupDraggable(floorYInput, (v) => {
        targetFloor.position.y = v;
        setVal('floorY', v);
        if (currentCity) currentCity.update();
    });
    setupDraggable(floorWInput, (v) => {
        targetFloor.scale.x = v;
        setVal('floorW', v);
        if (currentCity) currentCity.update();
    }, 0.1);
    setupDraggable(floorHInput, (v) => {
        targetFloor.scale.y = v;
        setVal('floorH', v);
        if (currentCity) currentCity.update();
    }, 0.1);

    setupDraggable(prismWInput, (v) => {
        targetPrisms.forEach(p => p.scale.x = v);
        setVal('prismW', v);
        if (currentCity) currentCity.update();
    }, 0.1);

    setupDraggable(prismHInput, (v) => {
        targetPrisms.forEach(p => {
            p.scale.z = v;
            p.position.z = v / 2;
        });
        setVal('prismD', v);
        if (currentCity) currentCity.update();
    }, 0.1);

    setupDraggable(prismSpacingInput, (v) => {
        setVal('prismSpacing', v);
        updatePrismPositions();
        if (currentCity) {
            currentCity.cityGrid.setPrismSpacing(v);
            currentCity.update();
        }
    });

    setupDraggable(maxCapScaleInput, (v) => {
        setVal('maxCapScale', v);
        if (currentCity) {
            currentCity.cityGrid.rowConfig.maxCapScale = v;
            currentCity.update();
        }
    }, 0.1);

    setupDraggable(lightSpacingInput, (v) => {
        setVal('lightSpacing', v);
        if (currentCity) {
            currentCity.cityGrid.rowConfig.street_light_spacing = v;
            currentCity.cityGrid.update();
        }
    }, 0.1);

    setupDraggable(maxCarsInput, (v) => {
        setVal('maxCars', v);
        if (currentCity) {
            currentCity.cityTraffic.options.maxCars = v;
            currentCity.cityTraffic.spawnInitialCars();
        }
    }, 1);

    setupDraggable(carSizeInput, (v) => {
        setVal('carSize', v);
        if (currentCity) {
            currentCity.cityTraffic.options.carSize = v;
        }
    }, 0.1);

    showTrafficLogsInput.addEventListener('change', (e) => {
        const val = e.target.checked;
        setVal('showTrafficLogs', val);
        if (currentCity) {
            currentCity.cityTraffic.options.loggingEnabled = val;
        }
    });

    setupDraggable(upbInput, (v) => {
        setVal('upb', v);
        if (currentCity) {
            currentCity.cityGrid.setUnitsPerBuilding(v);
            currentCity.cityTraffic.unitsPerBuilding = v;
            currentCity.cityTraffic.rebuildGraph();
        }
    }, 0.1);

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
        const prismH = parseFloat(document.getElementById('prismD').value) || 5;
        const prismsCSV = document.getElementById('prisms').value;
        const spacing = parseFloat(document.getElementById('prismSpacing').value) || 5;
        const maxCapScale = parseFloat(document.getElementById('maxCapScale').value) || 1.5;
        const lightSpacing = parseFloat(document.getElementById('lightSpacing').value) || 5.0;
        const maxCars = parseInt(document.getElementById('maxCars').value) || 20;
        const carSize = parseFloat(document.getElementById('carSize').value) || 2.0;
    
        setVal('seed', seed);
        setVal('upb', upb);
        setVal('prismW', prismW);
        setVal('prismD', prismH);
        setVal('prisms', prismsCSV);
        setVal('prismSpacing', spacing);
        setVal('maxCapScale', maxCapScale);
        setVal('lightSpacing', lightSpacing);
        setVal('maxCars', maxCars);
        setVal('carSize', carSize);
    
        const ySizes = prismsCSV.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const totalYLength = ySizes.reduce((a, b) => a + b, 0) + (ySizes.length - 1) * spacing;
        let currentY = -totalYLength / 2;
    
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.2, visible: wireframe });
    
        ySizes.forEach((ySize, i) => {
            const prism = new THREE.Mesh(geom, mat);
            prism.scale.set(prismW, ySize, prismH);
            prism.position.set(0, currentY + ySize / 2, prismH / 2);
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
            carAsset,
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
        currentCity.cityTraffic.options.maxCars = maxCars;
        currentCity.cityTraffic.options.carSize = carSize;
        currentCity.cityTraffic.options.loggingEnabled = showTrafficLogsInput.checked;
        currentCity.cityTraffic.spawnInitialCars();
        
        if (showTrafficLogsInput.checked) {
            currentCity.cityTraffic.dumpGraph();
        }
        
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

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const dt = clock.getDelta();
    if (currentCity) currentCity.updateTraffic(dt);

    controls.update();
    renderer.render(scene, camera);
}

init();