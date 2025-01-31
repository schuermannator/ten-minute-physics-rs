import GUI from 'lil-gui';
import * as THREE from 'three';

import { HashSimulation } from '../pkg';
import { memory } from '../pkg/index_bg.wasm';
import { Demo, Scene, SceneConfig } from './lib';

type HashDemoProps = {
    bodies: number;
    animate: boolean;
    showCollisions: boolean;
};

const HashDemoConfig: SceneConfig = {
    cameraZ: 2.5,
    cameraLookAt: new THREE.Vector3(0, 0.9, 0),
}

const baseColor = new THREE.Color(0xFF0000);
const collisionColor = new THREE.Color(0xFF8000);

class HashDemo implements Demo<HashSimulation, HashDemoProps> {
    sim: HashSimulation;
    scene: Scene;
    props: HashDemoProps;

    private mesh: THREE.InstancedMesh;
    private translationMatrix: THREE.Matrix4;
    private colors: Float32Array;
    private positions: Float32Array;
    private collisions: Uint8Array;

    constructor(rust_wasm: any, canvas: HTMLCanvasElement, scene: Scene, folder: GUI) {
        this.sim = new rust_wasm.HashSimulation(canvas);
        this.scene = scene;
        this.initControls(folder);
    }

    init() {
        this.initMesh();
    }

    update() {
        if (this.props.animate) {
            this.sim.step();
            this.updateMesh();
        }
    }

    reset() {
        this.sim.reset();
        this.updateMesh();
    }

    private initControls(folder: GUI) {
        this.props = {
            bodies: this.sim.num_bodies(),
            animate: true,
            showCollisions: false,
        };
        folder.add(this.props, 'bodies').disable();
        folder.add(this.props, 'showCollisions').name('show collisions');
        folder.add(this.props, 'animate');
    }

    private initMesh() {
        const material = new THREE.MeshPhongMaterial();
        const geometry = new THREE.SphereGeometry(this.sim.radius(), 8, 8);
        this.mesh = new THREE.InstancedMesh(geometry, material, this.sim.num_bodies());
        this.translationMatrix = new THREE.Matrix4();
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.colors = new Float32Array(3 * this.sim.num_bodies());
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.colors, 3, false, 1);
        this.scene.scene.add(this.mesh);

        // Here, we store the pointer to the positions buffer location after the simulation is
        // initialized (all allocations are completed). In the WASM linear heap, it will be 
        // constant thereafter, so we don't need to touch the array moving forward.
        const positionsPtr = this.sim.body_positions_ptr();
        this.positions = new Float32Array(memory.buffer, positionsPtr, this.sim.num_bodies() * 3);
        const collisionsPtr = this.sim.body_collisions_ptr();
        this.collisions = new Uint8Array(memory.buffer, collisionsPtr, this.sim.num_bodies());

        this.updateMesh();
    }

    private updateMesh() {
        for (let i = 0; i < this.positions.length; i++) {
            this.translationMatrix.makeTranslation(this.positions[3 * i], this.positions[3 * i + 1], this.positions[3 * i + 2]);
            this.mesh.setMatrixAt(i, this.translationMatrix);
            if (this.props.showCollisions && this.collisions[i] === 1) {
                //this.mesh.setColorAt(i, this.collisionColor);
                this.colors[3 * i] = collisionColor.r;
                this.colors[3 * i + 1] = collisionColor.g;
                this.colors[3 * i + 2] = collisionColor.b;
            } else {
                //this.mesh.setColorAt(i, this.baseColor);
                this.colors[3 * i] = baseColor.r;
                this.colors[3 * i + 1] = baseColor.g;
                this.colors[3 * i + 2] = baseColor.b;
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
    }
}

export { HashDemo, HashDemoConfig };
