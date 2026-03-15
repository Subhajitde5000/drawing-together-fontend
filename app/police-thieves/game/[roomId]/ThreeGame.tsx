"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface RemoteHint {
  playerId: string;
  name: string;
  x: number;
  z: number;
}

interface ThreeGameProps {
  role: "police" | "thief";
  phase?: string;
  myAlive?: boolean;
  otherPlayers?: Array<{ id: string; name: string; role: string; x: number; z: number; rotY: number; alive: boolean }>;
  onPositionUpdate?: (x: number, z: number, rotY: number) => void;
  onHintActivated?: (x: number, z: number) => void;
  remoteHints?: RemoteHint[];
}

const CITY_SIZE = 10;
const BLOCK_GAP = 22;
const HALF = (CITY_SIZE * BLOCK_GAP) / 2;

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export default function ThreeGame({ role, phase, myAlive = true, otherPlayers, onPositionUpdate, onHintActivated, remoteHints }: ThreeGameProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const joystickRef = useRef<HTMLCanvasElement>(null);
  const firstPersonRef = useRef(false);
  const [isFirstPerson, setIsFirstPerson] = useState(false);

  // Hint system (thief-only)
  const hintActiveRef = useRef(false);
  const hintTimeLeftRef = useRef(0);         // seconds remaining
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);   // 0–1 for ring animation
  const [hintTimeLeft, setHintTimeLeft] = useState(0);   // displayed countdown
  const [isHoldingHint, setIsHoldingHint] = useState(false);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleFP = () => {
    const next = !firstPersonRef.current;
    firstPersonRef.current = next;
    setIsFirstPerson(next);
  };

  // Multiplayer refs (updated each render without re-creating the scene)
  const phaseRef             = useRef(phase ?? "lobby");
  const myAliveRef           = useRef(myAlive);
  const otherPlayersRef      = useRef(otherPlayers ?? []);
  const onPositionUpdateRef  = useRef(onPositionUpdate);
  const onHintActivatedRef   = useRef(onHintActivated);
  const remoteHintsRef       = useRef(remoteHints ?? []);
  const lastPosSendRef       = useRef(0);
  const otherMeshesRef       = useRef<Map<string, THREE.Group>>(new Map());
  const pgPositionRef        = useRef({ x: 0, z: 0 }); // updated every frame

  // Keep refs in sync with latest props
  useEffect(() => { phaseRef.current = phase ?? "lobby"; }, [phase]);
  useEffect(() => { myAliveRef.current = myAlive; }, [myAlive]);
  useEffect(() => { otherPlayersRef.current = otherPlayers ?? []; }, [otherPlayers]);
  useEffect(() => { onPositionUpdateRef.current = onPositionUpdate; }, [onPositionUpdate]);
  useEffect(() => { onHintActivatedRef.current = onHintActivated; }, [onHintActivated]);
  useEffect(() => { remoteHintsRef.current = remoteHints ?? []; }, [remoteHints]);

  // Hold-to-hint handlers (thief only)
  const HOLD_DURATION = 2000; // ms to hold
  const HINT_SECONDS = 10;   // how long hint stays active
  const startHold = () => {
    if (role !== "thief" || hintActiveRef.current) return;
    setIsHoldingHint(true);
    const start = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setHoldProgress(Math.min(1, elapsed / HOLD_DURATION));
    }, 30);
    holdTimerRef.current = setTimeout(() => {
      clearInterval(holdIntervalRef.current!);
      hintActiveRef.current = true;
      hintTimeLeftRef.current = HINT_SECONDS;
      setHintTimeLeft(HINT_SECONDS);
      setHoldProgress(0);
      setIsHoldingHint(false);
      // Notify server with current position so police can see the hint
      if (onHintActivatedRef.current) {
        onHintActivatedRef.current(pgPositionRef.current.x, pgPositionRef.current.z);
      }
    }, HOLD_DURATION);
  };
  const cancelHold = () => {
    clearTimeout(holdTimerRef.current!);
    clearInterval(holdIntervalRef.current!);
    setIsHoldingHint(false);
    setHoldProgress(0);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 80, 220);

    // ── Camera ─────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 500);
    camera.position.set(0, 14, 22);
    camera.lookAt(0, 0, 0);

    // ── Lights ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffeedd, 0.6));
    const sun = new THREE.DirectionalLight(0xfff5cc, 2.5);
    sun.position.set(80, 120, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -HALF; sun.shadow.camera.right = HALF;
    sun.shadow.camera.top = HALF; sun.shadow.camera.bottom = -HALF;
    sun.shadow.bias = -0.001;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.5));

    // ── Materials ──────────────────────────────────────────────────────────
    const matRoad = new THREE.MeshLambertMaterial({ color: 0x2d3748 });
    const matWalk = new THREE.MeshLambertMaterial({ color: 0xc4c9d4 });
    const matGround = new THREE.MeshLambertMaterial({ color: 0x4a7c59 });
    const matWindow = new THREE.MeshStandardMaterial({ color: 0x7ec8e3, roughness: 0.1, metalness: 0.2, emissive: 0x2a5f7a, emissiveIntensity: 0.3 });
    const matLamp = new THREE.MeshStandardMaterial({ color: 0x888ea8, roughness: 0.4, metalness: 0.8 });
    const matLampGlow = new THREE.MeshStandardMaterial({ color: 0xfff0aa, emissive: 0xffdd66, emissiveIntensity: 2 });
    const matTrunk = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });
    const matLeaf = new THREE.MeshLambertMaterial({ color: 0x2d8a45 });
    const matLeafAlt = new THREE.MeshLambertMaterial({ color: 0x3aad55 });
    const matRoof = new THREE.MeshLambertMaterial({ color: 0x4a5568 });

    // ── Shared Geometries & Instancing ─────────────────────────────────────
    const sharedBox = new THREE.BoxGeometry(1, 1, 1);
    const sharedCyl = new THREE.CylinderGeometry(1, 1, 1, 8);

    const sharedWindowZ = new THREE.BoxGeometry(1.2, 1.2, 0.05);
    const sharedWindowX = new THREE.BoxGeometry(0.05, 1.2, 1.2);

    const sharedTreeTrunk = new THREE.CylinderGeometry(0.22, 0.30, 1, 7);
    const sharedTreeCrown1 = new THREE.SphereGeometry(1, 8, 6);
    const sharedTreeCrown2 = new THREE.SphereGeometry(1, 7, 5);

    const sharedLampPole = new THREE.CylinderGeometry(0.08, 0.12, 6, 8);
    const sharedLampArm = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6);
    const sharedLampHousing = new THREE.CylinderGeometry(0.15, 0.25, 0.5, 8);
    const sharedLampBulb = new THREE.SphereGeometry(0.18, 8, 6);

    const sharedDashH = new THREE.BoxGeometry(4, 0.01, 0.4);
    const sharedDashV = new THREE.BoxGeometry(0.4, 0.01, 4);

    const geoRoadH = new THREE.BoxGeometry(CITY_SIZE * BLOCK_GAP + BLOCK_GAP, 0.12, BLOCK_GAP);
    const geoRoadV = new THREE.BoxGeometry(BLOCK_GAP, 0.12, CITY_SIZE * BLOCK_GAP + BLOCK_GAP);

    const geoBungRoof = new THREE.CylinderGeometry(0, Math.SQRT1_2, 1, 4); // Adjusted for later scaling
    const geoBungWin = new THREE.BoxGeometry(0.9, 0.8, 0.06);
    const geoBungSill = new THREE.BoxGeometry(1.1, 0.12, 0.15);
    const geoBungChim = new THREE.BoxGeometry(0.5, 1.2, 0.5);
    const geoBungStep = new THREE.BoxGeometry(1.4, 0.15, 0.5);

    const geoCarBody = new THREE.BoxGeometry(2.0, 0.7, 4.2);
    const geoCarCabin = new THREE.BoxGeometry(1.7, 0.6, 2.2);
    const geoCarWind = new THREE.BoxGeometry(1.6, 0.5, 0.06);
    const geoCarHl = new THREE.BoxGeometry(0.35, 0.2, 0.06);
    const geoCarWheel = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
    const geoCarHub = new THREE.CylinderGeometry(0.15, 0.15, 0.23, 8);

    const geoParkingLine = new THREE.BoxGeometry(0.12, 0.01, 3.5);

    const dummy = new THREE.Object3D();

    const transforms = {
      windowZ: [] as THREE.Matrix4[],
      windowX: [] as THREE.Matrix4[],
      treeTrunk: [] as THREE.Matrix4[],
      treeCrown1: [] as THREE.Matrix4[],
      treeCrown2: [] as THREE.Matrix4[],
      lampPole: [] as THREE.Matrix4[],
      lampArm: [] as THREE.Matrix4[],
      lampHousing: [] as THREE.Matrix4[],
      lampBulb: [] as THREE.Matrix4[],
      dashH: [] as THREE.Matrix4[],
      dashV: [] as THREE.Matrix4[]
    };

    function addInstanced(type: keyof typeof transforms, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      transforms[type].push(dummy.matrix.clone());
    }

    // ── Ground ─────────────────────────────────────────────────────────────
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE * BLOCK_GAP + 40, CITY_SIZE * BLOCK_GAP + 40), matGround);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ── Roads ──────────────────────────────────────────────────────────────
    const cityExtent = CITY_SIZE * BLOCK_GAP;
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
    for (let i = -CITY_SIZE / 2; i <= CITY_SIZE / 2; i++) {
      const pos = i * BLOCK_GAP;
      const hRoad = new THREE.Mesh(geoRoadH, matRoad);
      hRoad.position.set(0, 0.06, pos); hRoad.receiveShadow = true; scene.add(hRoad);
      const vRoad = new THREE.Mesh(geoRoadV, matRoad);
      vRoad.position.set(pos, 0.06, 0); vRoad.receiveShadow = true; scene.add(vRoad);
      for (let d = -CITY_SIZE / 2; d < CITY_SIZE / 2; d++) {
        const dp = d * BLOCK_GAP + BLOCK_GAP / 2;
        addInstanced('dashH', dp, 0.13, pos);
        addInstanced('dashV', pos, 0.13, dp);
      }
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    const BCOLS = [0x8b9dc3, 0xb8a9c9, 0xe8d5c4, 0xc9b8a8, 0x9eb8d9, 0xd4c5b0, 0xa8c4d4, 0xc4b8a8];

    function addBuilding(x: number, z: number, w: number, d: number, h: number, color: number) {
      const wMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15 });
      const body = new THREE.Mesh(sharedBox, wMat);
      body.scale.set(w, h, d);
      body.position.set(x, h / 2, z); body.castShadow = true; body.receiveShadow = true; scene.add(body);
      const roof = new THREE.Mesh(sharedBox, matRoof);
      roof.scale.set(w + 0.4, 0.5, d + 0.4);
      roof.position.set(x, h + 0.25, z); roof.castShadow = true; scene.add(roof);
      const wg = 2.2;
      for (let wy = wg; wy < h - 1; wy += wg) {
        for (let wx = -w / 2 + wg / 2; wx < w / 2 - 0.5; wx += wg) {
          addInstanced('windowZ', x + wx, wy, z + d / 2 + 0.025);
          addInstanced('windowZ', x + wx, wy, z - d / 2 - 0.025);
        }
        for (let wz = -d / 2 + wg / 2; wz < d / 2 - 0.5; wz += wg) {
          addInstanced('windowX', x - w / 2 - 0.025, wy, z + wz);
          addInstanced('windowX', x + w / 2 + 0.025, wy, z + wz);
        }
      }
      const tank = new THREE.Mesh(sharedCyl, wMat);
      tank.scale.set(0.6, 1.2, 0.6);
      tank.position.set(x + w * 0.25, h + 1.1, z + d * 0.25); scene.add(tank);
    }

    function addTree(x: number, z: number) {
      const th = 2 + Math.random() * 1.5, cr = 1.6 + Math.random() * 1.2;
      addInstanced('treeTrunk', x, th / 2, z, 1, th, 1);
      addInstanced('treeCrown1', x, th + cr * 0.7, z, cr, cr, cr);
      addInstanced('treeCrown2', x + cr * 0.4, th + cr * 1.0, z - cr * 0.3, cr * 0.7, cr * 0.7, cr * 0.7);
    }

    function addLamp(x: number, z: number) {
      addInstanced('lampPole', x, 3, z);
      addInstanced('lampArm', x + 0.75, 6.15, z, 1, 1, 1, 0, 0, Math.PI / 2);
      addInstanced('lampHousing', x + 1.5, 6, z);
      addInstanced('lampBulb', x + 1.5, 5.85, z);
    }

    // ── Name board (canvas texture floating sign) ────────────────────────
    function makeNameBoard(name: string, x: number, y: number, z: number, rotY = 0) {
      const W = 256, H = 80;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d")!;
      // Background
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, "#1e293b"); bg.addColorStop(1, "#0f172a");
      ctx.fillStyle = bg;
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void }).roundRect(2, 2, W - 4, H - 4, 10);
      ctx.fill();
      // Border
      ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 3;
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void }).roundRect(2, 2, W - 4, H - 4, 10);
      ctx.stroke();
      // Text
      ctx.fillStyle = "#fef3c7";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(name.toUpperCase(), W / 2, H / 2);
      const tex = new THREE.CanvasTexture(cv);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(3.5, 1.1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
      );
      board.position.set(x, y, z);
      board.rotation.y = rotY;
      scene.add(board);
    }

    // ── Bungalow / small home ───────────────────────────────────────────────
    const BUNGALOW_NAMES = ["indrani Das", "Shreya de", "GREEN HOME", "PALM HOUSE", "SUNNY NEST", "MAPLE LODGE", "CEDAR HAVEN", "BLUE BIRD"];
    let bungalowNameIdx = 0;
    function addBungalow(x: number, z: number, rotY = 0) {
      const w = 5 + Math.random() * 2, d = 4 + Math.random() * 1.5, h = 2.8 + Math.random() * 0.6;
      const wallColor = [0xf5e6d0, 0xfde8c8, 0xe8d5c4, 0xfff8f0, 0xe8f4ea, 0xf0e8f8][Math.floor(Math.random() * 6)];
      const roofColor = [0xc0392b, 0x8e2421, 0x6d4c41, 0x3e2723, 0x455a64][Math.floor(Math.random() * 5)];
      const wMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.8 });
      const rMat = new THREE.MeshLambertMaterial({ color: roofColor });
      const grp = new THREE.Group();

      // Walls
      const walls = new THREE.Mesh(sharedBox, wMat);
      walls.scale.set(w, h, d);
      walls.position.y = h / 2; walls.castShadow = true; walls.receiveShadow = true; grp.add(walls);

      // Sloped roof (prism)
      const roof = new THREE.Mesh(geoBungRoof, rMat);
      roof.scale.set(Math.sqrt(w * w + d * d), h * 0.65, Math.sqrt(w * w + d * d));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = h + h * 0.3; roof.castShadow = true; grp.add(roof);

      // Door
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x7c4a1e, roughness: 0.7 });
      const door = new THREE.Mesh(sharedBox, doorMat);
      door.scale.set(0.85, 1.5, 0.08);
      door.position.set(0, 0.75, d / 2 + 0.04); grp.add(door);
      // Door knob
      const knob = new THREE.Mesh(sharedTreeCrown1, new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9 }));
      knob.scale.set(0.07, 0.07, 0.07);
      knob.position.set(0.3, 0.75, d / 2 + 0.09); grp.add(knob);

      // Front windows
      for (let wx = -1; wx <= 1; wx += 2) {
        const win = new THREE.Mesh(geoBungWin, matWindow);
        win.position.set(wx * 1.4, 1.4, d / 2 + 0.04); grp.add(win);
        const sill = new THREE.Mesh(geoBungSill, new THREE.MeshLambertMaterial({ color: 0xffffff }));
        sill.position.set(wx * 1.4, 0.98, d / 2 + 0.08); grp.add(sill);
      }

      // Chimney
      const chimney = new THREE.Mesh(geoBungChim, new THREE.MeshLambertMaterial({ color: 0x8b4513 }));
      chimney.position.set(w * 0.28, h + h * 0.55, 0); grp.add(chimney);

      // Small porch step
      const step = new THREE.Mesh(geoBungStep, new THREE.MeshLambertMaterial({ color: 0xbdb99a }));
      step.position.set(0, 0.08, d / 2 + 0.25); grp.add(step);

      grp.position.set(x, 0, z);
      grp.rotation.y = rotY;
      scene.add(grp);

      // Name board above door
      const bName = BUNGALOW_NAMES[bungalowNameIdx++ % BUNGALOW_NAMES.length];
      makeNameBoard(bName, x, h + 0.8, z + d / 2 + 0.15, rotY);
    }

    // ── Parked car ────────────────────────────────────────────────────────────
    const CAR_COLORS = [0xe53e3e, 0x3182ce, 0x38a169, 0xd69e2e, 0x805ad5, 0x2d3748, 0xf6ad55, 0x76e4f7];
    let carColorIdx = 0;
    function addParkedCar(x: number, z: number, rotY = 0) {
      const color = CAR_COLORS[carColorIdx++ % CAR_COLORS.length];
      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x7ec8e3, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 });
      const tireMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
      const grp = new THREE.Group();

      // Main body
      const carBody = new THREE.Mesh(geoCarBody, bodyMat);
      carBody.position.y = 0.55; carBody.castShadow = true; grp.add(carBody);
      // Cabin (raised top)
      const cabin = new THREE.Mesh(geoCarCabin, bodyMat);
      cabin.position.set(0, 1.15, -0.15); cabin.castShadow = true; grp.add(cabin);
      // Windscreen
      const wind = new THREE.Mesh(geoCarWind, glassMat);
      wind.position.set(0, 1.1, 0.95); grp.add(wind);
      // Rear window
      const rwind = new THREE.Mesh(geoCarWind, glassMat);
      rwind.position.set(0, 1.1, -1.25); grp.add(rwind);
      // Headlights
      const hlMat = new THREE.MeshStandardMaterial({ color: 0xfffde7, emissive: 0xffff88, emissiveIntensity: 1.5 });
      for (const sx of [-0.6, 0.6]) {
        const hl = new THREE.Mesh(geoCarHl, hlMat);
        hl.position.set(sx, 0.62, 2.13); grp.add(hl);
      }
      // Tail lights
      const tlMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1 });
      for (const sx of [-0.6, 0.6]) {
        const tl = new THREE.Mesh(geoCarHl, tlMat);
        tl.position.set(sx, 0.62, -2.13); grp.add(tl);
      }
      // Wheels
      for (const [wx, wz] of [[-1.1, 1.2], [1.1, 1.2], [-1.1, -1.2], [1.1, -1.2]]) {
        const wheel = new THREE.Mesh(geoCarWheel, tireMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.32, wz);
        wheel.castShadow = true; grp.add(wheel);
        // Hubcap
        const hub = new THREE.Mesh(geoCarHub, new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 }));
        hub.rotation.z = Math.PI / 2;
        hub.position.set(wx > 0 ? wx + 0.04 : wx - 0.04, 0.32, wz); grp.add(hub);
      }

      grp.position.set(x, 0, z); grp.rotation.y = rotY;
      scene.add(grp);
    }

    // ── Building name lookup ────────────────────────────────────────────────
    const OFFICE_NAMES = ["CITY BANK", "GRAND HOTEL", "TECH HUB", "MALL", "HOSPITAL", "POLICE HQ", "CITY HALL", "LIBRARY", "GYM", "COFFEE CO.", "PHARMACY", "HOTEL", "OFFICE HQ", "MARKET", "COURT", "CLINIC"];
    let officeNameIdx = 0;

    // ── City generation ──────────────────────────────────────────────────────
    const rng = seededRand(42);
    for (let ix = -CITY_SIZE / 2; ix < CITY_SIZE / 2; ix++) {
      for (let iz = -CITY_SIZE / 2; iz < CITY_SIZE / 2; iz++) {
        const cx = ix * BLOCK_GAP + BLOCK_GAP / 2;
        const cz = iz * BLOCK_GAP + BLOCK_GAP / 2;
        const bt = Math.floor(rng() * 6);  // 0-5 now
        const sw = new THREE.Mesh(sharedBox, matWalk);
        sw.scale.set(BLOCK_GAP - 3.5, 0.25, BLOCK_GAP - 3.5);
        sw.position.set(cx, 0.12, cz); sw.receiveShadow = true; scene.add(sw);

        if (bt <= 1) {
          // Office / commercial buildings with name boards
          const nb = 2 + Math.floor(rng() * 2);
          for (let b = 0; b < nb; b++) {
            const bx = cx + (rng() - 0.5) * (BLOCK_GAP - 10);
            const bz2 = cz + (rng() - 0.5) * (BLOCK_GAP - 10);
            const bw = 3 + rng() * 4, bd = 3 + rng() * 4, bh = 4 + rng() * 20;
            addBuilding(bx, bz2, bw, bd, bh, BCOLS[Math.floor(rng() * BCOLS.length)]);
            // Name board on front face
            const bName = OFFICE_NAMES[officeNameIdx++ % OFFICE_NAMES.length];
            makeNameBoard(bName, bx, bh + 1.0, bz2 + bd / 2 + 0.2);
          }
          const o = (BLOCK_GAP - 4) / 2;
          addLamp(cx - o, cz - o); addLamp(cx + o, cz + o);

          // Parked cars along the block edge road
          if (rng() > 0.4) addParkedCar(cx - 6, cz + 9, Math.PI / 2 + (rng() - 0.5) * 0.1);
          if (rng() > 0.4) addParkedCar(cx + 6, cz + 9, Math.PI / 2 + (rng() - 0.5) * 0.1);
          if (rng() > 0.4) addParkedCar(cx - 6, cz - 9, Math.PI / 2 + (rng() - 0.5) * 0.1);

        } else if (bt === 2) {
          // Park
          const pk = new THREE.Mesh(sharedBox, new THREE.MeshLambertMaterial({ color: 0x3aad55 }));
          pk.scale.set(BLOCK_GAP - 4.5, 0.15, BLOCK_GAP - 4.5);
          pk.position.set(cx, 0.18, cz); pk.receiveShadow = true; scene.add(pk);
          for (let t = 0; t < 8; t++) addTree(cx + (rng() - 0.5) * (BLOCK_GAP - 8), cz + (rng() - 0.5) * (BLOCK_GAP - 8));
          addLamp(cx - 4, cz);

        } else if (bt === 3) {
          // Mixed office + trees
          const bx2 = cx - 2, bz3 = cz - 2, bh2 = 3 + rng() * 5;
          addBuilding(bx2, bz3, 4.5, 4.5, bh2, BCOLS[Math.floor(rng() * BCOLS.length)]);
          makeNameBoard(OFFICE_NAMES[officeNameIdx++ % OFFICE_NAMES.length], bx2, bh2 + 1.0, bz3 + 2.45);
          addTree(cx + 3, cz + 2); addTree(cx + 3, cz - 3); addLamp(cx + 6, cz);

        } else if (bt === 4) {
          // Residential: bungalows with garden
          for (let b = 0; b < 2; b++) {
            const bx3 = cx + (b === 0 ? -3.5 : 3.5);
            const bz4 = cz + (rng() - 0.5) * 4;
            addBungalow(bx3, bz4, b === 0 ? 0 : Math.PI);
          }
          addTree(cx, cz + 5); addTree(cx, cz - 5);
          addLamp(cx - 8, cz);
          // Car in driveway
          if (rng() > 0.3) addParkedCar(cx - 3.5, cz + 4, 0);
          if (rng() > 0.3) addParkedCar(cx + 3.5, cz + 4, 0);

        } else {
          // Parking lot with multiple cars
          const lot = new THREE.Mesh(sharedBox, new THREE.MeshLambertMaterial({ color: 0x4a5568 }));
          lot.scale.set(BLOCK_GAP - 5, 0.1, BLOCK_GAP - 5);
          lot.position.set(cx, 0.18, cz); lot.receiveShadow = true; scene.add(lot);
          // Parking lines
          const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.4, transparent: true });
          for (let pi = -3; pi <= 3; pi++) {
            const pLine = new THREE.Mesh(geoParkingLine, lineMat);
            pLine.position.set(cx + pi * 2.5, 0.22, cz); scene.add(pLine);
          }
          // Cars in spots
          const numCars = 2 + Math.floor(rng() * 4);
          for (let c = 0; c < numCars; c++) {
            addParkedCar(cx + (c - numCars / 2 + 0.5) * 2.5, cz, rng() > 0.5 ? 0 : Math.PI);
          }
          addLamp(cx, cz);
        }

        // Street trees
        if (rng() > 0.3) addTree(cx - (BLOCK_GAP - 2) / 2, cz + (BLOCK_GAP - 2) / 2 - 1);
        if (rng() > 0.3) addTree(cx + (BLOCK_GAP - 2) / 2 - 1, cz - (BLOCK_GAP - 2) / 2);
        // Street-side parked car (occasional)
        if (rng() > 0.7) addParkedCar(cx + (BLOCK_GAP - 2) / 2 - 1, cz + BLOCK_GAP / 2 - 2, Math.PI / 2);
      }
    }

    // ── Instantiate Transforms ─────────────────────────────────────────────
    function createInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], cast = false, receive = false) {
      if (matrices.length === 0) return;
      const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      scene.add(mesh);
    }

    createInstanced(sharedWindowZ, matWindow, transforms.windowZ);
    createInstanced(sharedWindowX, matWindow, transforms.windowX);
    createInstanced(sharedTreeTrunk, matTrunk, transforms.treeTrunk, true, true);
    createInstanced(sharedTreeCrown1, matLeaf, transforms.treeCrown1, true, false);
    createInstanced(sharedTreeCrown2, matLeafAlt, transforms.treeCrown2, true, false);
    createInstanced(sharedLampPole, matLamp, transforms.lampPole, true, false);
    createInstanced(sharedLampArm, matLamp, transforms.lampArm, true, false);
    createInstanced(sharedLampHousing, matLamp, transforms.lampHousing, true, false);
    createInstanced(sharedLampBulb, matLampGlow, transforms.lampBulb, false, false);
    createInstanced(sharedDashH, dashMat, transforms.dashH, false, true);
    createInstanced(sharedDashV, dashMat, transforms.dashV, false, true);

    // ── Player ────────────────────────────────────────────────────────────
    const pColor = role === "police" ? 0x2563eb : 0xdc2626;
    const pAccent = role === "police" ? 0x1e3a8a : 0x7f1d1d;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 });
    const uniformMat = new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.5 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8 });

    const pg = new THREE.Group();

    // Body (torso)
    const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.0, 6, 10), uniformMat);
    bodyM.position.y = 1.3; bodyM.castShadow = true; pg.add(bodyM);

    // Head
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skinMat);
    headM.position.y = 2.5; headM.castShadow = true; pg.add(headM);

    // Face features (front = +Z direction)
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.055, 6, 5);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const lEye = new THREE.Mesh(eyeGeo, eyeMat);
    lEye.position.set(-0.11, 2.54, 0.28); pg.add(lEye);
    const rEye = new THREE.Mesh(eyeGeo, eyeMat);
    rEye.position.set(0.11, 2.54, 0.28); pg.add(rEye);
    // Eye whites
    const eyeWhiteGeo = new THREE.SphereGeometry(0.075, 6, 5);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const lEyeW = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    lEyeW.position.set(-0.11, 2.54, 0.255); pg.add(lEyeW);
    const rEyeW = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    rEyeW.position.set(0.11, 2.54, 0.255); pg.add(rEyeW);
    // Nose
    const noseM = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), skinMat);
    noseM.position.set(0, 2.44, 0.31); pg.add(noseM);
    // Mouth (small dark strip)
    const mouthM = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.04), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
    mouthM.position.set(0, 2.33, 0.30); pg.add(mouthM);

    // Hat
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 12), new THREE.MeshStandardMaterial({ color: pAccent }));
    hatBrim.position.y = 2.76; pg.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.38, 12), new THREE.MeshStandardMaterial({ color: pAccent }));
    hatTop.position.y = 2.96; pg.add(hatTop);
    // Hat visor / peak — sticks out FRONT (+Z) so you can tell which way player faces
    const visorM = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.06, 0.30),
      new THREE.MeshStandardMaterial({ color: pAccent, roughness: 0.6 })
    );
    visorM.position.set(0, 2.77, 0.33); pg.add(visorM);

    // Dark hair patch on BACK of head (makes it clear which side is back)
    const hairM = new THREE.Mesh(
      new THREE.SphereGeometry(0.33, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshStandardMaterial({ color: 0x2d1a0a, roughness: 0.9 })
    );
    hairM.position.set(0, 2.5, 0); hairM.rotation.x = Math.PI; pg.add(hairM);
    // Bright back stripe on body (yellow/white) — visible from behind
    const backStripeM = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.55, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 })
    );
    backStripeM.position.set(0, 1.4, -0.45); pg.add(backStripeM);

    // Badge
    const badgeM = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.05), new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.1 }));
    badgeM.position.set(0, 1.55, 0.44); pg.add(badgeM);

    // Neck
    const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.25, 8), skinMat);
    neckM.position.y = 2.22; pg.add(neckM);

    // ── Arms ──────────────────────────────────────────────────────────────
    // Upper arms (attached to shoulders, swing during walk)
    const armGeo = new THREE.CapsuleGeometry(0.11, 0.48, 4, 8);
    const fArmGeo = new THREE.CapsuleGeometry(0.09, 0.38, 4, 8);
    const handGeo = new THREE.SphereGeometry(0.12, 7, 6);

    const leftShoulder = new THREE.Group(); leftShoulder.position.set(-0.52, 1.85, 0);
    const rightShoulder = new THREE.Group(); rightShoulder.position.set(0.52, 1.85, 0);
    pg.add(leftShoulder); pg.add(rightShoulder);

    const lUpperArm = new THREE.Mesh(armGeo, uniformMat);
    lUpperArm.position.set(0, -0.32, 0); lUpperArm.castShadow = true;
    leftShoulder.add(lUpperArm);

    const rUpperArm = new THREE.Mesh(armGeo, uniformMat);
    rUpperArm.position.set(0, -0.32, 0); rUpperArm.castShadow = true;
    rightShoulder.add(rUpperArm);

    // Elbow pivots
    const lElbow = new THREE.Group(); lElbow.position.set(0, -0.67, 0);
    const rElbow = new THREE.Group(); rElbow.position.set(0, -0.67, 0);
    leftShoulder.add(lElbow); rightShoulder.add(rElbow);

    const lForearm = new THREE.Mesh(fArmGeo, skinMat);
    lForearm.position.y = -0.24; lForearm.castShadow = true; lElbow.add(lForearm);
    const rForearm = new THREE.Mesh(fArmGeo, skinMat);
    rForearm.position.y = -0.24; rForearm.castShadow = true; rElbow.add(rForearm);

    const lHand = new THREE.Mesh(handGeo, skinMat);
    lHand.position.y = -0.52; lElbow.add(lHand);
    const rHand = new THREE.Mesh(handGeo, skinMat);
    rHand.position.y = -0.52; rElbow.add(rHand);

    // ── Legs ──────────────────────────────────────────────────────────────
    const legGeo = new THREE.CapsuleGeometry(0.14, 0.55, 4, 8);
    const shinGeo = new THREE.CapsuleGeometry(0.11, 0.48, 4, 8);
    const footGeo = new THREE.BoxGeometry(0.22, 0.12, 0.38);

    const lHip = new THREE.Group(); lHip.position.set(-0.20, 0.58, 0);
    const rHip = new THREE.Group(); rHip.position.set(0.20, 0.58, 0);
    pg.add(lHip); pg.add(rHip);

    const lThigh = new THREE.Mesh(legGeo, uniformMat);
    lThigh.position.y = -0.36; lThigh.castShadow = true; lHip.add(lThigh);
    const rThigh = new THREE.Mesh(legGeo, uniformMat);
    rThigh.position.y = -0.36; rThigh.castShadow = true; rHip.add(rThigh);

    const lKnee = new THREE.Group(); lKnee.position.y = -0.73; lHip.add(lKnee);
    const rKnee = new THREE.Group(); rKnee.position.y = -0.73; rHip.add(rKnee);

    const lShin = new THREE.Mesh(shinGeo, uniformMat);
    lShin.position.y = -0.30; lShin.castShadow = true; lKnee.add(lShin);
    const rShin = new THREE.Mesh(shinGeo, uniformMat);
    rShin.position.y = -0.30; rShin.castShadow = true; rKnee.add(rShin);

    const lFoot = new THREE.Mesh(footGeo, shoeMat);
    lFoot.position.set(0, -0.60, 0.08); lKnee.add(lFoot);
    const rFoot = new THREE.Mesh(footGeo, shoeMat);
    rFoot.position.set(0, -0.60, 0.08); rKnee.add(rFoot);

    scene.add(pg);

    // ── Hint beacon (hidden until hint is active) ──────────────────────────
    const beaconGroup = new THREE.Group();
    // Vertical glowing pillar
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 3, transparent: true, opacity: 0.55 });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 12, 8), pillarMat);
    pillar.position.y = 6; beaconGroup.add(pillar);
    // Pulsing ring
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 2, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 32), ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; beaconGroup.add(ring);
    // Glow sphere at top
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xff6666, emissive: 0xff3333, emissiveIntensity: 4, transparent: true, opacity: 0.9 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), glowMat);
    glow.position.y = 12.5; beaconGroup.add(glow);
    // Point light at top
    const beaconLight = new THREE.PointLight(0xff3333, 6, 20, 1.5);
    beaconLight.position.y = 12; beaconGroup.add(beaconLight);
    beaconGroup.visible = false;
    scene.add(beaconGroup);

    // ── Remote hint beacons (shown on police screen for each thief hint) ──
    const remoteBeaconMeshes = new Map<string, THREE.Group>();
    const makeRemoteBeacon = () => {
      const bg = new THREE.Group();
      const pm = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 3, transparent: true, opacity: 0.6 });
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 12, 8), pm);
      pil.position.y = 6; bg.add(pil);
      const rm2 = new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0xff7700, emissiveIntensity: 2, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const rng = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 32), rm2);
      rng.rotation.x = Math.PI / 2; rng.position.y = 0.3; bg.add(rng);
      const gm2 = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xff8822, emissiveIntensity: 4, transparent: true, opacity: 0.9 });
      const gs = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), gm2);
      gs.position.y = 12.5; bg.add(gs);
      const bl = new THREE.PointLight(0xff8800, 6, 20, 1.5);
      bl.position.y = 12; bg.add(bl);
      bg.visible = false;
      scene.add(bg);
      return bg;
    };

    // ── Keyboard input ─────────────────────────────────────────────────────
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => { keys[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ── Camera spherical state ─────────────────────────────────────────────
    const cam = { theta: 0, phi: Math.PI / 5, radius: 20 };

    // passive mouse-move: horizontal = camera yaw
    let lastMX = -1;
    const onMouseMove = (e: MouseEvent) => {
      if (lastMX < 0) { lastMX = e.clientX; return; }
      cam.theta -= (e.clientX - lastMX) * 0.004;
      lastMX = e.clientX;
    };
    // left-click drag = vertical tilt
    let isDragging = false, prevMY = 0;
    const onMouseDown = (e: MouseEvent) => { isDragging = true; prevMY = e.clientY; };
    const onMouseUp = () => { isDragging = false; };
    const onMouseMoveV = (e: MouseEvent) => {
      if (!isDragging) return;
      cam.phi = Math.max(0.12, Math.min(Math.PI / 2.2, cam.phi + (e.clientY - prevMY) * 0.005));
      prevMY = e.clientY;
    };
    const onWheel = (e: WheelEvent) => {
      cam.radius = Math.max(5, Math.min(60, cam.radius + e.deltaY * 0.03));
    };
    mount.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    mount.addEventListener("mousemove", onMouseMove);
    mount.addEventListener("mousemove", onMouseMoveV);
    mount.addEventListener("mouseleave", () => { lastMX = -1; });
    mount.addEventListener("wheel", onWheel, { passive: true });

    // ── Virtual joystick: dual-zone touch ─────────────────────────────────
    const JOY_R = 55, JOY_KNOB = 22;
    const joyMove = { active: false, id: -1, base: { x: 0, y: 0 }, cur: { x: 0, y: 0 } };
    const joyLook = { active: false, id: -1, base: { x: 0, y: 0 }, cur: { x: 0, y: 0 } };

    const getTouchLocal = (t: Touch) => {
      const rect = mount.getBoundingClientRect();
      // Check if CSS rotated 90deg (portrait phone forced landscape)
      const isRotated = Math.abs(rect.width - mount.clientHeight) < Math.abs(rect.width - mount.clientWidth);
      if (isRotated) {
        // Rotated 90deg, transform-origin: top left, left: 100%
        // t.clientX maps to internal Y. t.clientY maps to internal X (inverted)
        return { x: t.clientY - rect.top, y: rect.right - t.clientX };
      }
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const pos = getTouchLocal(t);
        const cw = mount.clientWidth;
        if (pos.x < cw / 2 && !joyMove.active) {
          joyMove.active = true; joyMove.id = t.identifier;
          joyMove.base.x = joyMove.cur.x = pos.x;
          joyMove.base.y = joyMove.cur.y = pos.y;
        } else if (pos.x >= cw / 2 && !joyLook.active) {
          joyLook.active = true; joyLook.id = t.identifier;
          joyLook.cur.x = pos.x; joyLook.cur.y = pos.y;
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const pos = getTouchLocal(t);
        if (joyMove.active && t.identifier === joyMove.id) {
          joyMove.cur.x = pos.x; joyMove.cur.y = pos.y;
        } else if (joyLook.active && t.identifier === joyLook.id) {
          cam.theta -= (pos.x - joyLook.cur.x) * 0.007;
          cam.phi = Math.max(0.12, Math.min(Math.PI / 2.2, cam.phi + (pos.y - joyLook.cur.y) * 0.007));
          joyLook.cur.x = pos.x; joyLook.cur.y = pos.y;
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joyMove.id) { joyMove.active = false; joyMove.id = -1; }
        if (t.identifier === joyLook.id) { joyLook.active = false; joyLook.id = -1; }
      }
    };
    mount.addEventListener("touchstart", onTouchStart, { passive: false });
    mount.addEventListener("touchmove", onTouchMove, { passive: false });
    mount.addEventListener("touchend", onTouchEnd);
    mount.addEventListener("touchcancel", onTouchEnd);

    // ── Velocity ───────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const MAX_SPEED = 12, ACCEL = 60, DAMPING = 10;
    const vel = { x: 0, z: 0 };
    let targetRotY = 0;

    // ── Canvas refs for overlays ───────────────────────────────────────────
    const minimapCanvas = minimapRef.current;
    const mmCtx = minimapCanvas?.getContext("2d") ?? null;
    const MM = 180, SCALE = MM / (CITY_SIZE * BLOCK_GAP);

    const joyCanvas = joystickRef.current;
    const joyCtx = joyCanvas?.getContext("2d") ?? null;

    // ── Animate ────────────────────────────────────────────────────────────
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      // Joystick → world-space input
      let joyX = 0, joyZ = 0;
      if (joyMove.active) {
        const rx = joyMove.cur.x - joyMove.base.x;
        const rz = joyMove.cur.y - joyMove.base.y;
        const dist = Math.sqrt(rx * rx + rz * rz);
        const n = Math.min(dist, JOY_R) / JOY_R;
        joyX = (rx / Math.max(dist, 0.001)) * n;
        joyZ = (rz / Math.max(dist, 0.001)) * n;
      }

      // Combine keyboard + joystick relative to camera
      let inX = joyX * Math.cos(cam.theta) + joyZ * Math.sin(cam.theta);
      let inZ = -joyX * Math.sin(cam.theta) + joyZ * Math.cos(cam.theta);
      if (keys["KeyW"] || keys["ArrowUp"]) { inX -= Math.sin(cam.theta); inZ -= Math.cos(cam.theta); }
      if (keys["KeyS"] || keys["ArrowDown"]) { inX += Math.sin(cam.theta); inZ += Math.cos(cam.theta); }
      if (keys["KeyA"] || keys["ArrowLeft"]) { inX -= Math.cos(cam.theta); inZ += Math.sin(cam.theta); }
      if (keys["KeyD"] || keys["ArrowRight"]) { inX += Math.cos(cam.theta); inZ -= Math.sin(cam.theta); }

      const hasInput = inX !== 0 || inZ !== 0;
      if (hasInput) {
        const l = Math.sqrt(inX * inX + inZ * inZ);
        inX /= l; inZ /= l;
        vel.x += inX * ACCEL * dt; vel.z += inZ * ACCEL * dt;
        const sp = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        if (sp > MAX_SPEED) { vel.x = vel.x / sp * MAX_SPEED; vel.z = vel.z / sp * MAX_SPEED; }
        targetRotY = Math.atan2(vel.x, vel.z);
      } else {
        vel.x *= Math.max(0, 1 - DAMPING * dt);
        vel.z *= Math.max(0, 1 - DAMPING * dt);
      }

      pg.position.x = Math.max(-HALF + 1, Math.min(HALF - 1, pg.position.x + vel.x * dt));
      pg.position.z = Math.max(-HALF + 1, Math.min(HALF - 1, pg.position.z + vel.z * dt));

      if (hasInput) {
        const diff = ((targetRotY - pg.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        pg.rotation.y += diff * Math.min(1, 12 * dt);
      }

      // ── Freeze police during hiding phase ────────────────────────────────
      if (phaseRef.current === "hiding" && role === "police") {
        vel.x = 0; vel.z = 0;
      }

      // ── Spectator mode: dead thieves cannot move (Rule 8) ───────────────
      if (!myAliveRef.current) {
        vel.x = 0; vel.z = 0;
      }

      // ── Report position to server (throttled to ~10/s, spectators excluded) ──
      const nowMs = Date.now();
      pgPositionRef.current.x = pg.position.x;
      pgPositionRef.current.z = pg.position.z;
      if (myAliveRef.current && nowMs - lastPosSendRef.current > 100 && onPositionUpdateRef.current) {
        lastPosSendRef.current = nowMs;
        onPositionUpdateRef.current(pg.position.x, pg.position.z, pg.rotation.y);
      }

      // ── Sync other-player 3-D meshes ──────────────────────────────────────
      const ops = otherPlayersRef.current;
      const seenIds = new Set<string>();
      for (const op of ops) {
        seenIds.add(op.id);
        let opMesh = otherMeshesRef.current.get(op.id);
        if (!opMesh) {
          // Build a simplified character mesh (colour-coded by role)
          opMesh = new THREE.Group();
          const isPolice = op.role === "police";
          const bodyMat  = new THREE.MeshStandardMaterial({ color: isPolice ? 0x2563eb : 0xdc2626, roughness: 0.5 });
          const skinMat2 = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 });
          const accentMat = new THREE.MeshStandardMaterial({ color: isPolice ? 0x1e3a8a : 0x7f1d1d });
          const bodyM2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.0, 4, 8), bodyMat);
          bodyM2.position.y = 1.3; bodyM2.castShadow = true; opMesh.add(bodyM2);
          const headM2 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), skinMat2);
          headM2.position.y = 2.5; headM2.castShadow = true; opMesh.add(headM2);
          // Eyes (front = +Z)
          const eyeM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
          const eyeWM = new THREE.MeshStandardMaterial({ color: 0xffffff });
          const eyeG = new THREE.SphereGeometry(0.055, 5, 4);
          const eyeWG = new THREE.SphereGeometry(0.075, 5, 4);
          const lEye2W = new THREE.Mesh(eyeWG, eyeWM); lEye2W.position.set(-0.11, 2.54, 0.255); opMesh.add(lEye2W);
          const rEye2W = new THREE.Mesh(eyeWG, eyeWM); rEye2W.position.set(0.11, 2.54, 0.255); opMesh.add(rEye2W);
          const lEye2 = new THREE.Mesh(eyeG, eyeM); lEye2.position.set(-0.11, 2.54, 0.28); opMesh.add(lEye2);
          const rEye2 = new THREE.Mesh(eyeG, eyeM); rEye2.position.set(0.11, 2.54, 0.28); opMesh.add(rEye2);
          const hatTop2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.38, 10), accentMat);
          hatTop2.position.y = 2.96; opMesh.add(hatTop2);
          const hatBrim2 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 10), accentMat);
          hatBrim2.position.y = 2.76; opMesh.add(hatBrim2);
          // Hat visor sticking out front (+Z)
          const visor2 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.30), accentMat);
          visor2.position.set(0, 2.77, 0.33); opMesh.add(visor2);
          // Dark hair patch on BACK of head
          const hair2 = new THREE.Mesh(
            new THREE.SphereGeometry(0.33, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6),
            new THREE.MeshStandardMaterial({ color: 0x2d1a0a, roughness: 0.9 })
          );
          hair2.position.set(0, 2.5, 0); hair2.rotation.x = Math.PI; opMesh.add(hair2);
          // Bright back stripe (yellow) — visible from behind
          const backStripe2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.55, 0.06),
            new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 })
          );
          backStripe2.position.set(0, 1.4, -0.45); opMesh.add(backStripe2);
          scene.add(opMesh);
          otherMeshesRef.current.set(op.id, opMesh);
        }
        opMesh.position.set(op.x, 0, op.z);
        opMesh.rotation.y = op.rotY;
        opMesh.visible = op.alive;
      }
      // Remove meshes for players who left
      for (const [id, mesh] of otherMeshesRef.current.entries()) {
        if (!seenIds.has(id)) {
          scene.remove(mesh);
          otherMeshesRef.current.delete(id);
        }
      }

      // ── Walk animation (arms + legs swing) ───────────────────────────────
      const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      const walkBlend = Math.min(1, speed / MAX_SPEED); // 0 = idle, 1 = full walk
      const walkPhase = Date.now() * 0.006;
      const swingAmt = 0.55 * walkBlend;
      // Arms: opposite to corresponding leg
      leftShoulder.rotation.x = Math.sin(walkPhase) * swingAmt;
      rightShoulder.rotation.x = -Math.sin(walkPhase) * swingAmt;
      // Forearms hang naturally, slight bend when walking
      lElbow.rotation.x = 0.15 + 0.2 * walkBlend;
      rElbow.rotation.x = 0.15 + 0.2 * walkBlend;
      // Legs
      lHip.rotation.x = -Math.sin(walkPhase) * swingAmt * 0.9;
      rHip.rotation.x = Math.sin(walkPhase) * swingAmt * 0.9;
      // Knees bend on back-swing
      lKnee.rotation.x = Math.max(0, -lHip.rotation.x) * 0.6;
      rKnee.rotation.x = Math.max(0, -rHip.rotation.x) * 0.6;

      // ── Hint beacon update ────────────────────────────────────────────────
      if (hintActiveRef.current) {
        hintTimeLeftRef.current -= dt;
        if (hintTimeLeftRef.current <= 0) {
          hintTimeLeftRef.current = 0;
          hintActiveRef.current = false;
        }
        // Sync countdown to React state every ~0.5s (use floor to reduce re-renders)
        const newLeft = Math.ceil(hintTimeLeftRef.current);
        setHintTimeLeft(prev => prev !== newLeft ? newLeft : prev);
        // Position beacon at player
        beaconGroup.position.set(pg.position.x, 0, pg.position.z);
        beaconGroup.visible = true;
        // Pulse ring scale
        const pulse = 1 + 0.25 * Math.sin(Date.now() * 0.006);
        ring.scale.set(pulse, pulse, pulse);
        // Flicker pillar opacity
        pillarMat.opacity = 0.4 + 0.3 * Math.abs(Math.sin(Date.now() * 0.004));
        glowMat.emissiveIntensity = 3 + 2 * Math.sin(Date.now() * 0.008);
      } else {
        beaconGroup.visible = false;
        setHintTimeLeft(0);
      }

      // ── Remote hint beacons (police sees thief hints) ────────────────────
      const activeHints = remoteHintsRef.current;
      const activeIds = new Set(activeHints.map(h => h.playerId));
      // Show beacons for active hints
      for (const hint of activeHints) {
        let bg = remoteBeaconMeshes.get(hint.playerId);
        if (!bg) {
          bg = makeRemoteBeacon();
          remoteBeaconMeshes.set(hint.playerId, bg);
        }
        bg.position.set(hint.x, 0, hint.z);
        bg.visible = true;
        const t = Date.now();
        const pulse = 1 + 0.25 * Math.sin(t * 0.006);
        (bg.children[1] as THREE.Mesh).scale.set(pulse, pulse, pulse);
      }
      // Hide beacons for expired hints
      for (const [pid, bg] of remoteBeaconMeshes) {
        if (!activeIds.has(pid)) bg.visible = false;
      }

      // ── Camera ────────────────────────────────────────────────────────
      if (firstPersonRef.current) {
        // First-person: position at player eye level, look forward
        const eyeY = 2.5;  // head height
        camera.position.set(
          pg.position.x - Math.sin(cam.theta) * 0.2,
          eyeY,
          pg.position.z - Math.cos(cam.theta) * 0.2
        );
        camera.lookAt(
          pg.position.x - Math.sin(cam.theta) * 20,
          eyeY + Math.sin(cam.phi - Math.PI / 2) * 10,
          pg.position.z - Math.cos(cam.theta) * 20
        );
        // Hide player body parts so we don't see ourselves
        pg.traverse(c => { if (c instanceof THREE.Mesh) c.visible = false; });
      } else {
        // Third-person orbit
        pg.traverse(c => { if (c instanceof THREE.Mesh) c.visible = true; });
        camera.position.x = pg.position.x + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta);
        camera.position.y = cam.radius * Math.cos(cam.phi) + 2;
        camera.position.z = pg.position.z + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta);
        camera.lookAt(pg.position.x, 2, pg.position.z);
      }

      renderer.render(scene, camera);

      // ── Minimap ────────────────────────────────────────────────────────
      if (mmCtx && minimapCanvas) {
        const cx2 = MM / 2, cy2 = MM / 2;
        mmCtx.clearRect(0, 0, MM, MM);
        mmCtx.fillStyle = "rgba(15,23,42,0.88)";
        mmCtx.beginPath(); mmCtx.roundRect(0, 0, MM, MM, 12); mmCtx.fill();
        mmCtx.strokeStyle = "#475569"; mmCtx.lineWidth = 2;
        for (let i = -CITY_SIZE / 2; i <= CITY_SIZE / 2; i++) {
          const p = i * BLOCK_GAP * SCALE + cx2;
          mmCtx.beginPath(); mmCtx.moveTo(0, p); mmCtx.lineTo(MM, p); mmCtx.stroke();
          mmCtx.beginPath(); mmCtx.moveTo(p, 0); mmCtx.lineTo(p, MM); mmCtx.stroke();
        }
        const mx = cx2 + pg.position.x * SCALE;
        const my = cy2 + pg.position.z * SCALE;
        mmCtx.save(); mmCtx.translate(mx, my); mmCtx.rotate(pg.rotation.y);
        mmCtx.fillStyle = role === "police" ? "#3b82f6" : "#ef4444";
        mmCtx.beginPath(); mmCtx.moveTo(0, -6); mmCtx.lineTo(-4, 5); mmCtx.lineTo(4, 5); mmCtx.closePath(); mmCtx.fill();
        mmCtx.restore();
        mmCtx.beginPath(); mmCtx.arc(mx, my, 4, 0, Math.PI * 2);
        mmCtx.fillStyle = "white"; mmCtx.fill();
        mmCtx.beginPath(); mmCtx.arc(mx, my, 2.5, 0, Math.PI * 2);
        mmCtx.fillStyle = role === "police" ? "#3b82f6" : "#ef4444"; mmCtx.fill();

        // Hint beacon pulsing ring on minimap
        if (hintActiveRef.current) {
          const pulse2 = 8 + 5 * Math.abs(Math.sin(Date.now() * 0.005));
          mmCtx.beginPath(); mmCtx.arc(mx, my, pulse2, 0, Math.PI * 2);
          mmCtx.strokeStyle = `rgba(255,60,60,${0.5 + 0.5 * Math.abs(Math.sin(Date.now() * 0.005))})`;
          mmCtx.lineWidth = 2.5; mmCtx.stroke();
          // "!" label
          mmCtx.fillStyle = "#ff4444";
          mmCtx.font = "bold 14px sans-serif"; mmCtx.textAlign = "center";
          mmCtx.fillText("!", mx, my - pulse2 - 4);
        }
        // Remote hint beacons on minimap (orange — shown to all, especially police)
        for (const hint of remoteHintsRef.current) {
          const hx = cx2 + hint.x * SCALE;
          const hz = cy2 + hint.z * SCALE;
          const pulse3 = 8 + 5 * Math.abs(Math.sin(Date.now() * 0.005));
          mmCtx.beginPath(); mmCtx.arc(hx, hz, pulse3, 0, Math.PI * 2);
          mmCtx.strokeStyle = `rgba(255,150,0,${0.6 + 0.4 * Math.abs(Math.sin(Date.now() * 0.005))})`;
          mmCtx.lineWidth = 2.5; mmCtx.stroke();
          mmCtx.fillStyle = "#ff9900";
          mmCtx.font = "bold 12px sans-serif"; mmCtx.textAlign = "center";
          mmCtx.fillText("!", hx, hz - pulse3 - 4);
        }
        mmCtx.fillStyle = "rgba(255,255,255,0.4)"; mmCtx.font = "bold 10px sans-serif";
        mmCtx.textAlign = "center"; mmCtx.fillText("N", cx2, 14);
      }

      // ── Virtual joystick canvas ────────────────────────────────────────
      if (joyCtx && joyCanvas) {
        const JW = joyCanvas.width, JH = joyCanvas.height;
        joyCtx.clearRect(0, 0, JW, JH);

        const drawStick = (bx: number, by: number, kx: number, ky: number, active: boolean) => {
          joyCtx.beginPath(); joyCtx.arc(bx, by, JOY_R, 0, Math.PI * 2);
          joyCtx.fillStyle = active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)"; joyCtx.fill();
          joyCtx.strokeStyle = active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)";
          joyCtx.lineWidth = 2; joyCtx.stroke();
          const g = joyCtx.createRadialGradient(kx - 3, ky - 3, 2, kx, ky, JOY_KNOB);
          g.addColorStop(0, active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.38)");
          g.addColorStop(1, active ? "rgba(200,220,255,0.4)" : "rgba(255,255,255,0.10)");
          joyCtx.beginPath(); joyCtx.arc(kx, ky, JOY_KNOB, 0, Math.PI * 2);
          joyCtx.fillStyle = g; joyCtx.fill();
        };

        // Left (move)
        const LBX = 90, LBY = JH - 90;
        let lkx = LBX, lky = LBY;
        if (joyMove.active) {
          const rx = joyMove.cur.x - joyMove.base.x;
          const rz = joyMove.cur.y - joyMove.base.y;
          const dist = Math.sqrt(rx * rx + rz * rz);
          const cl = Math.min(dist, JOY_R);
          const scx = JW / (joyCanvas.getBoundingClientRect().width || JW);
          const scy = JH / (joyCanvas.getBoundingClientRect().height || JH);
          lkx = LBX + (rx / Math.max(dist, 0.001)) * cl * scx;
          lky = LBY + (rz / Math.max(dist, 0.001)) * cl * scy;
        }
        drawStick(LBX, LBY, lkx, lky, joyMove.active);

        // Right (look)
        const RBX = JW - 90, RBY = JH - 90;
        drawStick(RBX, RBY, RBX, RBY, joyLook.active);

        joyCtx.fillStyle = "rgba(255,255,255,0.28)";
        joyCtx.font = "bold 11px sans-serif"; joyCtx.textAlign = "center";
        joyCtx.fillText("MOVE", LBX, LBY + JOY_R + 18);
        joyCtx.fillText("LOOK", RBX, RBY + JOY_R + 18);
      }
    };
    animate();

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", onResize);
      mount.removeEventListener("mousedown", onMouseDown);
      mount.removeEventListener("mousemove", onMouseMove);
      mount.removeEventListener("mousemove", onMouseMoveV);
      mount.removeEventListener("wheel", onWheel);
      mount.removeEventListener("touchstart", onTouchStart);
      mount.removeEventListener("touchmove", onTouchMove);
      mount.removeEventListener("touchend", onTouchEnd);
      mount.removeEventListener("touchcancel", onTouchEnd);
      // Clean up other-player meshes
      for (const mesh of otherMeshesRef.current.values()) scene.remove(mesh);
      otherMeshesRef.current.clear();
      // Clean up remote beacon meshes
      for (const bg of remoteBeaconMeshes.values()) scene.remove(bg);
      remoteBeaconMeshes.clear();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [role]);

  const fpColor = role === "police" ? "bg-blue-600 hover:bg-blue-500 border-blue-400" : "bg-red-600 hover:bg-red-500 border-red-400";

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" style={{ cursor: isFirstPerson ? "none" : "crosshair", touchAction: "none" }} />

      {/* ── HINT ACTIVE banner (thief) ── */}
      {hintTimeLeft > 0 && role === "thief" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse">
          <div className="bg-red-600/90 backdrop-blur-md text-white text-xl font-black uppercase tracking-widest px-8 py-3 rounded-2xl shadow-2xl border-2 border-red-400 flex items-center gap-3">
            <span className="text-2xl">📍</span>
            Location Revealed!
            <span className="bg-red-800/80 px-3 py-1 rounded-lg text-base font-mono">{hintTimeLeft}s</span>
          </div>
        </div>
      )}

      {/* ── Hint button (thief only) ── */}
      {role === "thief" && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          {/* Circular hold-progress ring */}
          <div className="relative">
            <svg width="80" height="80" className="absolute -inset-1 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              <circle
                cx="40" cy="40" r="35" fill="none"
                stroke={hintActiveRef.current ? "#ff4444" : "#fbbf24"}
                strokeWidth="5"
                strokeDasharray={`${2 * Math.PI * 35}`}
                strokeDashoffset={`${2 * Math.PI * 35 * (1 - holdProgress)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.03s linear" }}
              />
            </svg>
            <button
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              disabled={hintActiveRef.current}
              className={`relative w-16 h-16 rounded-full flex flex-col items-center justify-center text-white font-bold text-xs uppercase tracking-wide shadow-xl border-2 select-none transition-all duration-150 ${hintActiveRef.current
                ? "bg-red-700/80 border-red-400 cursor-not-allowed"
                : isHoldingHint
                  ? "bg-amber-500 border-amber-300 scale-95"
                  : "bg-amber-600/90 hover:bg-amber-500 border-amber-400 active:scale-95"
                }`}
            >
              <span className="text-xl">📍</span>
              <span className="text-[10px] leading-tight">{hintActiveRef.current ? `${hintTimeLeft}s` : "HINT"}</span>
            </button>
          </div>
          <span className="text-[11px] text-white/60 font-medium">
            {hintActiveRef.current ? "🔴 Revealed to all" : isHoldingHint ? "Hold..." : "Hold 2s to reveal"}
          </span>
        </div>
      )}

      {/* ── View toggle button ── */}
      <button
        onClick={toggleFP}
        className={`absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-xl border text-white text-sm font-bold uppercase tracking-widest shadow-xl transition-all duration-200 backdrop-blur-md ${isFirstPerson
          ? fpColor + " ring-2 ring-white/30"
          : "bg-slate-800/80 hover:bg-slate-700/90 border-slate-500"
          }`}
      >
        <span className="text-lg">{isFirstPerson ? "👁️" : "🎮"}</span>
        {isFirstPerson ? "1st Person" : "3rd Person"}
      </button>

      {/* Minimap */}
      <canvas ref={minimapRef} width={180} height={180}
        className="absolute top-3 right-3 rounded-xl pointer-events-none"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)" }}
      />
      <div className="absolute top-3 right-3 pointer-events-none" style={{ width: 180 }}>
        <span className="block w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>MAP</span>
      </div>

      {/* Virtual joystick overlay */}
      <canvas ref={joystickRef} width={600} height={300}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
