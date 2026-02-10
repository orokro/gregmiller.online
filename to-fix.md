# GardenTheme Performance Issues Report

This report identifies the primary causes of slowness within the `GardenTheme` implementation, specifically focusing on the `GardenScatter.js` component and the theme's update cycle.

## 1. GardenScatter.js (Primary Bottleneck)

*   **Inefficient Grid Iteration**: The `refresh()` method recalculates grid cells based on a `cellSize` of 10 every frame. On modern high-resolution displays, this results in tens of thousands of iterations, string concatenations (`${i}_${j}`), and `Map` lookups per frame.
*   **Scene Graph Thrashing**: `updateItems()` frequently calls `this.add(item)` and `this.remove(item)` for every scattered object based on visibility/culling. Adding/removing objects from the scene graph is an expensive operation in Three.js.
*   **CPU-Side Culling**: Bounds checking for every item against every UI prism is performed on the CPU every frame.
*   **Lack of Instancing**: Every flower and leaf is a unique `Object3D` clone. This results in high memory overhead and a massive number of draw calls as density increases.

## 2. GardenBlock.js (Memory & Initialization)

*   **Geometry Proliferation**: Each UI block clones 9 separate geometries to support unique UV reprojection. This multiplies memory usage by the number of elements on the page.
*   **Frequent Buffer Updates**: UVs are reprojected and re-uploaded to the GPU (via `attributes.uv.needsUpdate`) every time the block updates, which currently happens every frame.

## 3. Systemic Issues (GardenTheme & GardenSystem)

*   **Redundant `onTick` Execution**: `GardenTheme.onTick` triggers a full system update (`gardenSystem.update(prisms)`) every single frame. This forces all scatterers and blocks to re-run their layout and culling logic even when the user is not scrolling or resizing.
*   **Scene Graph Searching**: The theme searches through `manager.registeredElements` every frame to find "garden_prism" meshes, which is unnecessary overhead.

## Recommended Fixes

1.  **Switch to `InstancedMesh`**: Replace individual clones in `GardenScatter` with `InstancedMesh` to reduce draw calls to a single call per asset type.
2.  **Implement Dirty Flags**: Only trigger layout and scattering logic when the background resizes or when the UI prisms change (scroll/resize).
3.  **GPU Culling**: Move prism-based culling logic into the vertex shader of the `InstancedMesh`.
4.  **Optimize Block Geometry**: Consider using a single geometry with vertex attributes for stretching/scaling instead of 9 separate meshes per block.
5.  **Cache Prism References**: Store references to prism volumes instead of searching for them every frame.
