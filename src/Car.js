import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Car {
    constructor(scene, physicsWorld, material) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.material = material;

        this.chassisDimensions = new CANNON.Vec3(2, 1, 4.5); // Half extents roughly
        this.chassisBody = null;
        this.vehicle = null;
        this.wheelMeshes = [];
        this.chassisMesh = null;

        this.initPhysics();
        this.initVisuals();
    }

    initPhysics() {
        const chassisShape = new CANNON.Box(this.chassisDimensions);
        this.chassisBody = new CANNON.Body({ mass: 1500 });
        this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.5, 0)); // Center of mass adjustment
        this.chassisBody.position.set(0, 5, 0);
        this.chassisBody.angularVelocity.set(0, 0, 0);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
        });

        const wheelOptions = {
            radius: 0.4,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 1.4, // Drift factor! Lower = more drift
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true,
        };

        // Front Left
        wheelOptions.chassisConnectionPointLocal.set(1.2, 0, 2.5);
        this.vehicle.addWheel(wheelOptions);

        // Front Right
        wheelOptions.chassisConnectionPointLocal.set(-1.2, 0, 2.5);
        this.vehicle.addWheel(wheelOptions);

        // Rear Left
        wheelOptions.chassisConnectionPointLocal.set(1.2, 0, -2.5);
        this.vehicle.addWheel(wheelOptions);

        // Rear Right
        wheelOptions.chassisConnectionPointLocal.set(-1.2, 0, -2.5);
        this.vehicle.addWheel(wheelOptions);

        this.vehicle.addToWorld(this.physicsWorld);

        // Wheel bodies (for visuals mostly, raycast handles physics)
        const wheelBodies = [];
        this.vehicle.wheelInfos.forEach((wheel) => {
            const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20);
            const wheelBody = new CANNON.Body({ mass: 0 });
            wheelBody.type = CANNON.Body.KINEMATIC;
            wheelBody.collisionFilterGroup = 0; // Turn off collisions
            const q = new CANNON.Quaternion();
            q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
            wheelBody.addShape(cylinderShape, new CANNON.Vec3(0, 0, 0), q);
            wheelBodies.push(wheelBody);
            // this.physicsWorld.addBody(wheelBody); // Not strictly needed for raycast vehicle
        });
    }

    initVisuals() {
        // Cybertruck Body (Extruded Shape)
        const shape = new THREE.Shape();
        const length = 5;
        const height = 1.6;
        const width = 2.2;
        const wheelBase = 3.5;
        const overhangFront = 1.0;
        const overhangRear = 0.5; // Short rear overhang

        // Side profile (facing right)
        // Start bottom rear
        shape.moveTo(-length / 2 + overhangRear, 0.5);
        // Rear wheel arch
        shape.lineTo(-length / 2 + overhangRear + 0.5, 0.5);
        shape.lineTo(-length / 2 + overhangRear + 0.7, 1.0);
        shape.lineTo(-length / 2 + overhangRear + 1.3, 1.0);
        shape.lineTo(-length / 2 + overhangRear + 1.5, 0.5);

        // Bottom middle
        shape.lineTo(length / 2 - overhangFront - 1.5, 0.5);

        // Front wheel arch
        shape.lineTo(length / 2 - overhangFront - 1.3, 0.5);
        shape.lineTo(length / 2 - overhangFront - 1.1, 1.0);
        shape.lineTo(length / 2 - overhangFront - 0.5, 1.0);
        shape.lineTo(length / 2 - overhangFront - 0.3, 0.5);

        // Front bumper
        shape.lineTo(length / 2, 0.5);
        // Front nose (vertical bit)
        shape.lineTo(length / 2, 0.8);
        // Hood/Windshield slope to peak
        shape.lineTo(0, height + 0.5); // Peak at center-ish
        // Bed slope to rear
        shape.lineTo(-length / 2, 1.2); // Rear deck height
        // Rear vertical
        shape.lineTo(-length / 2, 0.5);

        const extrudeSettings = {
            steps: 1,
            depth: width,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.05,
            bevelSegments: 2
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        // Center the geometry
        geometry.center();

        const material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.9,
            roughness: 0.2,
            flatShading: true
        }); // Stainless Steel look

        this.chassisMesh = new THREE.Mesh(geometry, material);
        this.chassisMesh.castShadow = true;
        this.chassisMesh.receiveShadow = true;

        // Add Windows (Simple black planes)
        // This is a bit complex to place perfectly on the extruded shape without UVs or multi-material.
        // For "Low Poly", the shape is the most important.

        this.scene.add(this.chassisMesh);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 24);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

        this.vehicle.wheelInfos.forEach((_, index) => {
            const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
            wheelMesh.castShadow = true;
            this.scene.add(wheelMesh);
            this.wheelMeshes.push(wheelMesh);
        });
    }

    update(keys) {
        const maxSteerVal = 0.5;
        const maxForce = 1500;
        const brakeForce = 20;

        // Steering
        let steer = 0;
        if (keys.a) steer += maxSteerVal;
        if (keys.d) steer -= maxSteerVal;
        this.vehicle.setSteeringValue(steer, 0);
        this.vehicle.setSteeringValue(steer, 1);

        // Engine
        let force = 0;
        if (keys.w) force += maxForce;
        if (keys.s) force -= maxForce;
        this.vehicle.applyEngineForce(force, 2);
        this.vehicle.applyEngineForce(force, 3);
        // 4WD for Cybertruck?
        this.vehicle.applyEngineForce(force, 0);
        this.vehicle.applyEngineForce(force, 1);

        // Braking
        if (keys[' ']) {
            this.vehicle.setBrake(brakeForce, 0);
            this.vehicle.setBrake(brakeForce, 1);
            this.vehicle.setBrake(brakeForce, 2);
            this.vehicle.setBrake(brakeForce, 3);
        } else {
            this.vehicle.setBrake(0, 0);
            this.vehicle.setBrake(0, 1);
            this.vehicle.setBrake(0, 2);
            this.vehicle.setBrake(0, 3);
        }

        // Sync Visuals
        this.chassisMesh.position.copy(this.chassisBody.position);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion);

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position);
            this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }
    }
}
