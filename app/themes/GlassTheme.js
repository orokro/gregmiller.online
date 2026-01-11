/*
	GlassTheme.js
	-------------

	Renders a 9-slice glass box.

	LOGIC:
	- Uses "Null Wrappers" to isolate Rotation from Scaling.
	- TRUSTS BLENDER ORIGINS COMPLETELY (No auto-centering).
	- Aligns all wrappers to Z=0.
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
	}

	async init(manager) {
		manager.setEnvironmentTexture('/env/Basic_2K_01.jpg', 7.0);

		const [gltf] = await manager.assetsReady(['/models/glass_slice.glb']);

		if (!gltf) {
			console.error("GlassTheme: Failed to load model.");
			return;
		}

		console.log("GlassTheme: GLB Loaded. Extracting wrappers...");

		Object.keys(this.assets).forEach(name => {
			const node = gltf.getObjectByName(name);

			if (node) {
				// 1. Clone original
				const original = node.clone(true);

				// 2. Wrap in a group
				// We DO NOT change the position of 'original'.
				// We trust its origin relative to the other pieces is correct in Blender.
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

			// 1. Position: Explicitly set Z to 0 for everyone.
			obj.position.set(x, y, 0);

			// 2. Scale: Apply to the wrapper (fixes rotation distortion)
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
