const fs = require('fs');
const path = require('path');

function inspectGLB(filePath) {
    console.log(`Inspecting: ${filePath}`);
    const buffer = fs.readFileSync(filePath);

    // GLB Header
    const magic = buffer.readUInt32LE(0);
    if (magic !== 0x46546C67) {
        console.error('Not a valid GLB file');
        return;
    }

    const version = buffer.readUInt32LE(4);
    const length = buffer.readUInt32LE(8);
    console.log(`GLB Version: ${version}`);
    console.log(`Total Length: ${length} bytes`);

    // First Chunk (JSON)
    const chunkLength = buffer.readUInt32LE(12);
    const chunkType = buffer.readUInt32LE(16);

    if (chunkType !== 0x4E4F534A) {
        console.error('First chunk is not JSON');
        return;
    }

    const jsonChunk = buffer.toString('utf8', 20, 20 + chunkLength);
    const gltf = JSON.parse(jsonChunk);

    console.log('\n--- General Info ---');
    console.log(`Meshes: ${gltf.meshes ? gltf.meshes.length : 0}`);
    console.log(`Animations: ${gltf.animations ? gltf.animations.length : 0}`);
    console.log(`Nodes: ${gltf.nodes ? gltf.nodes.length : 0}`);
    console.log(`Skins: ${gltf.skins ? gltf.skins.length : 0}`);

    if (gltf.animations) {
        console.log('\n--- Animations ---');
        gltf.animations.forEach((anim, index) => {
            console.log(`\nAnim ${index}: "${anim.name || 'unnamed'}"`);
            console.log(`  Channels: ${anim.channels.length}`);
            
            // Map samplers for convenience
            anim.channels.forEach((channel, cIdx) => {
                const targetNode = gltf.nodes[channel.target.node];
                const path = channel.target.path;
                console.log(`    Channel ${cIdx}: Node "${targetNode.name || channel.target.node}" -> ${path}`);
            });
        });
    }

    if (gltf.meshes) {
        console.log('\n--- Meshes & Morph Targets ---');
        gltf.meshes.forEach((mesh, index) => {
            console.log(`\nMesh ${index}: "${mesh.name || 'unnamed'}"`);
            mesh.primitives.forEach((prim, pIdx) => {
                if (prim.targets) {
                    console.log(`  Primitive ${pIdx} has ${prim.targets.length} morph targets.`);
                    if (mesh.extras && mesh.extras.targetNames) {
                        console.log(`    Names: ${mesh.extras.targetNames.join(', ')}`);
                    }
                }
            });
        });
    }

    if (gltf.nodes) {
        console.log('\n--- Node Hierarchy ---');
        const printNode = (nodeIdx, depth = 0) => {
            const node = gltf.nodes[nodeIdx];
            const indent = '  '.repeat(depth);
            let info = `${indent}- Node ${nodeIdx}: "${node.name || 'unnamed'}"`;
            if (node.mesh !== undefined) info += ` (Mesh: ${node.mesh})`;
            if (node.skin !== undefined) info += ` (Skin: ${node.skin})`;
            console.log(info);

            if (node.children) {
                node.children.forEach(childIdx => printNode(childIdx, depth + 1));
            }
        };

        // Find root nodes (nodes not mentioned as children)
        const childNodes = new Set();
        gltf.nodes.forEach(node => {
            if (node.children) node.children.forEach(c => childNodes.add(c));
        });

        gltf.nodes.forEach((node, idx) => {
            if (!childNodes.has(idx)) {
                printNode(idx);
            }
        });
    }
}

const glbPath = path.join(__dirname, 'models', 'Butterfly.glb');
inspectGLB(glbPath);