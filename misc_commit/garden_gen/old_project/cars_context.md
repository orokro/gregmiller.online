# Traffic System & Car Orientation Analysis

## System Overview
The traffic system in this project is a procedural, graph-based simulation integrated into the `City` class. It manages vehicle movement across a dynamically generated road network.

### 1. Graph Architecture
The network is defined by a series of nodes and directed edges:
*   **Nodes:** Placed at intersections and boundary "endpoints."
*   **Edges (Lanes):**
    *   **Main Roads:** Bi-directional lanes running North/South along the `BlockRow` structures.
    *   **Side Roads:** Single-lane roads running East/West between prisms. The direction of these roads alternates per row (Left-to-Right vs. Right-to-Left) to create variety.
*   **Flow:** Cars spawn at boundary endpoints, traverse the graph by picking random edges at intersections, and despawn when they reach another boundary endpoint.

### 2. Car Rotation & Orientation Logic
The cars currently maintain correct orientation (facing the direction of travel and staying upright) in all four cardinal directions because of how the coordinate systems are decoupled.

#### Global Coordinate Context
*   The project uses **Z-up** as the global orientation (defined in `main_city.js` via `camera.up.set(0, 0, 1)`).
*   The `City` object itself is rotated (`rotation.x = Math.PI / 2`) to bridge the gap between the generator's internal Y-up logic and the global Z-up world.

#### Rotation Implementation
The orientation "works" because of three specific steps in `CityTraffic.js`:

1.  **Explicit Up Vector:** Every car is placed inside a `container` (a `THREE.Object3D`). The container's up vector is explicitly set to global UP:
    ```javascript
    container.up.set(0, 0, 1);
    ```
2.  **World-Space `lookAt`:** When the car moves, the system calculates its heading using the `lookAt` method pointed at a world-space target:
    ```javascript
    const targetWorld = car.edge.end.clone();
    car.container.parent.localToWorld(targetWorld);
    car.container.lookAt(targetWorld);
    ```
    By using a world-space target and a fixed global `up`, Three.js calculates the correct yaw (heading) for any direction (North, South, East, West) while ensuring the car's roof always points toward the global Z-sky.
3.  **Model Offset:** Since the source car models in `Cars_Library.glb` face the negative direction, a 180-degree correction is applied to the child mesh:
    ```javascript
    mesh.rotation.y = Math.PI;
    ```

### 3. Summary of Movement
*   **North/South:** Handled by edges between `gridNodes` on the main roads.
*   **East/West:** Handled by edges between `leftIdx` and `rightIdx` nodes on the side roads.
*   **Translation:** Handled by `lerp`ing between the start and end vectors of the current edge.
