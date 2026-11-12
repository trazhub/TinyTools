"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/form";
import { FileDropzone } from "@/components/tool/file-dropzone";
import { errorMessage } from "./shared";

const MAX_BYTES = 200 * 1024 * 1024;

function greyMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
}

async function parseModel(file: File): Promise<THREE.Object3D> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "glb" || ext === "gltf") {
    const buffer = await file.arrayBuffer();
    return new Promise((resolve, reject) =>
      new GLTFLoader().parse(buffer, "", (g) => resolve(g.scene), () => reject(new Error("Could not read that glTF file. A .glb file works best because it holds everything in one file."))),
    );
  }
  if (ext === "obj") {
    const obj = new OBJLoader().parse(await file.text());
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = greyMaterial();
    });
    return obj;
  }
  if (ext === "stl") {
    const geometry = new STLLoader().parse(await file.arrayBuffer());
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, greyMaterial());
  }
  throw new Error("Use a .glb, .gltf, .obj or .stl file.");
}

export default function Viewer3D() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ show: (o: THREE.Object3D) => void; wireframe: (on: boolean) => void; spin: (on: boolean) => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [wire, setWire] = useState(false);
  const [spin, setSpin] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const grid = new THREE.GridHelper(10, 10, 0x000000, 0xcccccc);
    scene.add(grid);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
    camera.position.set(3, 2.5, 4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let model: THREE.Object3D | null = null;
    let wireOn = false;

    const applyWire = () =>
      model?.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) (mat as THREE.MeshStandardMaterial).wireframe = wireOn;
      });

    const dispose = (root: THREE.Object3D) =>
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        for (const mat of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) mat.dispose();
      });

    api.current = {
      show(next) {
        if (model) {
          scene.remove(model);
          dispose(model);
        }
        model = next;
        scene.add(model);
        applyWire();
        // Centre the model on the grid and frame it.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += size.y / 2;
        const radius = Math.max(size.x, size.y, size.z, 0.001);
        grid.scale.setScalar(radius / 5);
        camera.near = radius / 100;
        camera.far = radius * 100;
        camera.updateProjectionMatrix();
        camera.position.set(radius * 1.2, radius * 0.9, radius * 1.6);
        controls.target.set(0, size.y / 2, 0);
        controls.update();
      },
      wireframe(on) {
        wireOn = on;
        applyWire();
      },
      spin(on) {
        controls.autoRotate = on;
      },
    };

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      api.current = null;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      if (model) dispose(model);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  async function load([file]: File[]) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) return setError("That file is over 200 MB, which is too large for the browser.");
    try {
      api.current?.show(await parseModel(file));
      api.current?.wireframe(wire);
      setName(file.name);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <FileDropzone accept=".glb,.gltf,.obj,.stl" hint="GLB, glTF, OBJ or STL. Nothing is uploaded." onFiles={load} />
      {error && <Alert tone="error">{error}</Alert>}
      <div>
        <div ref={host} className="h-[60vh] min-h-72 w-full touch-none border border-foreground" aria-label="3D view. Drag to rotate, scroll to zoom, right-drag to pan." />
        <p className="mt-2 text-sm text-muted-foreground">{name ?? "No model loaded."} Drag to rotate, scroll to zoom, right-drag to pan.</p>
      </div>
      <div className="flex flex-wrap gap-6">
        <Checkbox
          label="Wireframe"
          checked={wire}
          onCheckedChange={(v) => {
            setWire(v);
            api.current?.wireframe(v);
          }}
        />
        <Checkbox
          label="Auto-rotate"
          checked={spin}
          onCheckedChange={(v) => {
            setSpin(v);
            api.current?.spin(v);
          }}
        />
      </div>
    </div>
  );
}
