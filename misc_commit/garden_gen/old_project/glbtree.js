#!/cygdrive/c/nvm4w/nodejs/node

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Mock the Browser Environment
const { window } = new JSDOM('', { url: "http://localhost" });
global.window = window;
global.document = window.document;
global.self = global;
global.HTMLElement = window.HTMLElement;
global.URL = window.URL;

async function main() {
	const args = process.argv.slice(2);
	const flags = {
		ignore: "",
		showMaterials: false,
		quoteNames: false,
		file: ""
	};

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '-i' || args[i] === '-I') {
			flags.ignore = args[++i];
		} else if (args[i] === '-m') {
			flags.showMaterials = true;
		} else if (args[i] === '-q') {
			flags.quoteNames = true;
		} else if (!args[i].startsWith('-')) {
			flags.file = args[i];
		}
	}

	if (!flags.file) {
		console.log("Usage: glbtree [-i 'ignore|pattern'] [-m] [-q] <file.glb>");
		return;
	}

	const filePath = path.resolve(process.cwd(), flags.file);
	if (!fs.existsSync(filePath)) {
		console.error(`Error: File not found -> ${filePath}`);
		return;
	}

	const ignoreRegex = flags.ignore ? new RegExp(flags.ignore, 'i') : null;
	const buffer = fs.readFileSync(filePath);
	const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

	const loader = new GLTFLoader();
	const materialMap = new Map();
	let matCounter = 0;

	function getMaterialId(mat) {
		if (!materialMap.has(mat)) materialMap.set(mat, ++matCounter);
		return materialMap.get(mat);
	}

	function formatName(name) {
		return flags.quoteNames ? `"${name}"` : name;
	}

	function walk(obj, prefix = "", isLast = true) {
		const name = obj.name || "Unnamed";
		if (ignoreRegex && ignoreRegex.test(name)) return;

		const connector = isLast ? "└── " : "├── ";
		const nextPrefix = prefix + (isLast ? "    " : "│   ");

		let typeLabel = "[G]";
		if (obj.isMesh) typeLabel = "[M]";
		else if (obj.isSkinnedMesh) typeLabel = "[SM]";
		else if (obj.isBone) typeLabel = "[B]";

		console.log(`${prefix}${connector}${typeLabel} ${formatName(name)}`);

		if (flags.showMaterials && obj.material) {
			const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
			mats.forEach((m, idx) => {
				const hasChildren = obj.children && obj.children.length > 0;
				const isLastMat = (idx === mats.length - 1) && !hasChildren;
				const matConnector = isLastMat ? "└── " : "├── ";
				const matName = m.name || 'Unnamed';
				console.log(`${nextPrefix}${matConnector}[MTL: ${getMaterialId(m)}] ${formatName(matName)}`);
			});
		}

		const children = obj.children || [];
		for (let i = 0; i < children.length; i++) {
			walk(children[i], nextPrefix, i === children.length - 1);
		}
	}

	try {
		const gltf = await loader.parseAsync(arrayBuffer, '');
		console.log(path.basename(filePath));
		walk(gltf.scene, "", true);
	} catch (err) {
		console.error("Failed to parse GLB:", err);
	}
}

main().catch(err => {
	console.error("Fatal Error:", err);
	process.exit(1);
});
