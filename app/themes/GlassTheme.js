/*
	GlassTheme.js
	-------------

	Renders a 9-slice glass box.

	Updates:
	- Uses .hdr environment map
	- Adds Camera-anchored PointLight
	- Overrides material for maximum "shiny" glass look
*/

import * as THREE from 'three';

export class GlassTheme {

	constructor() {
		this.assets = {
			Center: null,
			Top_Left: null, Top: null, Top_Right: null,
			Left: null, Right: null,
			Bottom_Left: null, Bottom: null, Bottom_Right: null
		};

		this.cornerSize = 30;
		this.depthScale = 20;

        // Light reference for cleanup
        this.camLight = null;
	}

	async init(manager) {
        // 1. Load HDR Environment (High exposure for brightness)
		manager.setEnvironmentTexture('/env/brown_photostudio_02_2k.hdr', 1.0);

        // 2. Add Camera Light (Dynamic Flash)
        // Positioned slightly up/right to create nice specular highlights on the glass edges
        this.camLight = new THREE.PointLight(0xffffff, 2000, 5000); // Color, Intensity, Distance
        this.camLight.position.set(50, 50, 50);
        manager.camera.add(this.camLight);

		// 3. Load GLB
		const [gltf] = await manager.assetsReady(['/models/glass_slice.glb']);

		if (!gltf) {
			console.error("GlassTheme: Failed to load model.");
			return;
		}

		console.log("GlassTheme: GLB Loaded. Processing materials...");

        // 4. Create the "Super Shiny" Glass Material
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xeefffe,
            transmission: 1.0,  // Full transmission
            opacity: 1.0,
            metalness: 0.0,
            roughness: 0.0,     // Perfectly smooth
            ior: 1.5,           // Glass Refractive Index
            thickness: 1.5,     // Volume
            envMapIntensity: 3.0, // Bright reflections
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            side: THREE.DoubleSide
        });

		Object.keys(this.assets).forEach(name => {
			const node = gltf.getObjectByName(name);

			if (node) {
				const original = node.clone(true);

                // MATERIAL OVERRIDE:
                // Apply the shiny material to all meshes inside the part
                original.traverse((child) => {
                    if (child.isMesh) {
                        child.material = glassMaterial;
                        // Enable shadows if we ever turn them on
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

				// Wrap in group (Logic from previous step)
				const wrapper = new THREE.Group();
				wrapper.add(original);

				this.assets[name] = wrapper;
			}
		});

		manager.registeredElements.forEach((data) => {
			if (data.type === 'box') {
				this.buildBox(manager, data);
				manager.updateElementPosition(data.id);
			}
		});

		manager.requestRender();
	}

	destroy(manager) {
		manager.clearEnvironmentTexture();

        // Remove light
        if (this.camLight) {
            this.camLight.parent.remove(this.camLight);
            this.camLight.dispose();
            this.camLight = null;
        }
	}

	onTick(manager, time) {
	}

	buildBox(manager, data) {
		if (!this.assets.Center) return;

		const parent = data.empties.center;
		while (parent.children.length > 0) {
			parent.remove(parent.children[0]);
		}

		Object.keys(this.assets).forEach(key => {
			const master = this.assets[key];
			if (!master) return;

			const instance = master.clone(true);
			instance.name = key;
			parent.add(instance);
		});
	}

	updateBox(manager, data, rect) {
		if (!this.assets.Center) return;

		const group = data.empties.center;

		const W = rect.width;
		const H = rect.height;
		const C = this.cornerSize;
		const Z = this.depthScale;

		const halfW = W / 2;
		const halfH = H / 2;
		const offset = C / 2;

		const innerW = Math.max(0.01, W - (C * 2));
		const innerH = Math.max(0.01, H - (C * 2));

		const transform = (name, x, y, sX, sY) => {
			const obj = group.getObjectByName(name);
			if (!obj) return;

			obj.position.set(x, y, 0);
			obj.scale.set(sX, sY, Z);
		};

		transform('Top_Left',    -halfW + offset,  halfH - offset, C, C);
		transform('Top_Right',    halfW - offset,  halfH - offset, C, C);
		transform('Bottom_Left', -halfW + offset, -halfH + offset, C, C);
		transform('Bottom_Right', halfW - offset, -halfH + offset, C, C);

		transform('Top',    0,  halfH - offset, innerW, C);
		transform('Bottom', 0, -halfH + offset, innerW, C);
		transform('Left',  -halfW + offset, 0, C, innerH);
		transform('Right',  halfW - offset, 0, C, innerH);

		transform('Center', 0, 0, innerW, innerH);
	}
}
