import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

let scene, camera, renderer, controls;
let ground;
let targetPrisms = [];
let wireframeEnabled = true;

async function init() {
    const container = document.getElementById('canvas-container');

    // UI Elements
    const wireframeInput = document.getElementById('wireframe');
    const hdrIntensityInput = document.getElementById('hdrIntensity');
    
    const groundWidthInput = document.getElementById('groundWidth');
    const groundHeightInput = document.getElementById('groundHeight');

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
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x4da83b, 
        side: THREE.DoubleSide 
    });
    ground = new THREE.Mesh(geometry, material);
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
    }, 0.1);

    setupDraggable(groundHeightInput, (v) => {
        ground.scale.y = v;
    }, 0.1);

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

    // Initial Prisms
    regeneratePrisms();

    animate();
}

function regeneratePrisms() {
    // Clear existing
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
    controls.update();
    renderer.render(scene, camera);
}

init();