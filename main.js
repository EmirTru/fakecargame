import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Car } from './src/Car.js';
import { World } from './src/World.js';

// --- Init Physics ---
const physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0), // m/s²
});
// Default material
const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
    friction: 0.3,
    restitution: 0.3,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3,
});
physicsWorld.addContactMaterial(defaultContactMaterial);

// --- Init Three.js ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.fog = new THREE.Fog(0x111111, 20, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Game Objects ---
const world = new World(scene, physicsWorld);
const car = new Car(scene, physicsWorld, defaultMaterial);

// --- Input Handling ---
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    ' ': false,
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') keys[' '] = true;
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
    if (e.key === ' ') keys[' '] = false;
});

// --- Game Loop ---
const timeStep = 1 / 60;
let lastCallTime;

const animate = (time) => {
    requestAnimationFrame(animate);

    const now = performance.now() / 1000;
    if (!lastCallTime) {
        physicsWorld.step(timeStep);
    } else {
        const dt = now - lastCallTime;
        physicsWorld.step(timeStep, dt, 3);
    }
    lastCallTime = now;

    // Update entities
    car.update(keys);

    // Camera follow
    const carPos = car.chassisBody.position;
    const offset = new THREE.Vector3(0, 5, -10); // Behind and above
    offset.applyQuaternion(car.chassisBody.quaternion); // Rotate offset with car? Maybe too dizzying.
    // Simple follow for now:
    camera.position.lerp(new THREE.Vector3(carPos.x, carPos.y + 5, carPos.z + 10), 0.1);
    camera.lookAt(carPos.x, carPos.y, carPos.z);

    renderer.render(scene, camera);

    // Update UI
    const speed = Math.round(car.chassisBody.velocity.length() * 3.6); // m/s to km/h
    document.getElementById('speedometer').innerText = `${speed} KM/H`;
};

animate();

// --- Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
