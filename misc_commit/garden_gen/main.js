import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

let scene, camera, renderer, controls;
let ground;

async function init() {
    const container = document.getElementById('canvas-container');

    // UI Elements
    const hdrIntensityInput = document.getElementById('hdrIntensity');
    const groundWidthInput = document.getElementById('groundWidth');
    const groundHeightInput = document.getElementById('groundHeight');

    // Three.js Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Facing forward (Z+), staring at center (0,0,0)
    camera.position.set(0, 0, 20); 

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
    // Facing forward (already does by default in X/Y plane in Three.js if not rotated)
    // Actually PlaneGeometry is in X/Y plane. 
    scene.add(ground);

    // Initial Scales
    ground.scale.set(parseFloat(groundWidthInput.value), parseFloat(groundHeightInput.value), 1);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 10);
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

    // Setup Draggable UI
    setupDraggable(hdrIntensityInput, (v) => {
        renderer.toneMappingExposure = v;
    });

    setupDraggable(groundWidthInput, (v) => {
        ground.scale.x = v;
    }, 0.1);

    setupDraggable(groundHeightInput, (v) => {
        ground.scale.y = v;
    }, 0.1);

    window.addEventListener('resize', onWindowResize);

    animate();
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
