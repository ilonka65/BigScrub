import { INSTAL_STATE } from './src/Config.js';
import { bigScrubEcosystem } from './speciesConfig.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadAndRenderEcosystemVectors } from './src/MapController.js';

// ==========================================
// 1. ENGINE RENDERER INITIALIZATION
// ==========================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05050a, 1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 500000);
camera.position.set(0, 1500, 2500);

// Locate where you initialize OrbitControls and set the focal target:
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, -590, 0); // Force camera center to look right at the map floor!


// Global Scenic Nodes
const mapGroup = new THREE.Group();
const genomicMatrixGroup = new THREE.Group();
const filamentGroup = new THREE.Group();
const boundaryVectorGroup = new THREE.Group();
const remnantVectorGroup = new THREE.Group();

scene.add(mapGroup);
scene.add(genomicMatrixGroup);
scene.add(filamentGroup);
scene.add(boundaryVectorGroup);
scene.add(remnantVectorGroup);

// Global point cloud asset storage map
const loadedLandscapeRemnants = new Map();

// Real-world reserve locations matching your 1-5 index directories
const STORAGE_BASE_URL = "https://ilonka.io";
const targetRainforestReserves = [
  { id: 1, name: "Victoria Park Nature Reserve", coords: { lon: 153.41, lat: -28.90 }, dir: `${STORAGE_BASE_URL}/1/` },
  { id: 2, name: "Booyong Flora Reserve", coords: { lon: 153.45, lat: -28.74 }, dir: `${STORAGE_BASE_URL}/2/` },
  { id: 3, name: "Big Scrub Flora Reserve", coords: { lon: 153.24, lat: -28.69 }, dir: `${STORAGE_BASE_URL}/3/` },
  { id: 4, name: "Minyon Falls Nature Reserve", coords: { lon: 153.38, lat: -28.62 }, dir: `${STORAGE_BASE_URL}/4/` },
  { id: 5, name: "Boomerang Falls Flora Reserve", coords: { lon: 153.37, lat: -28.63 }, dir: `${STORAGE_BASE_URL}/5/` }
];

// ==========================================
// 2. SCENIC SCALE CONSTANTS
// ==========================================
const TRACK_SPACING = 12.0;
const BASE_RADIUS = 800;
const RING_RADIUS = 1200;

// ==========================================
// 3. SCIENTIFIC MATH & UTILITIES
// ==========================================
function projectCoordinates(lon, lat, scale = 1000) {
  const x = (lon - 153.34228) * Math.cos(-28.63444 * Math.PI / 180) * scale;
  const z = (lat - (-28.63444)) * scale;
  return { x, z };
}

async function fetchFastaWithFallback(specimen) {
  const G = specimen.genus;
  const S = specimen.species;

  // Matches your new Cyberduck underscore file structures perfectly!
  const underscorePath = 'https://ilonka.io/genetics/' + G + '_' + S + '_alignment.fasta';


  try {
    const response = await fetch(underscorePath);
    if (response.ok) return response;
  } catch (e) {
    // Fallback or catch
  }

  throw new Error(`Genomics asset unreachable: ${G} ${S}`);
}

// ==========================================
// 4. CORE GEOMETRIC BRACKET SYSTEM
// ==========================================
function drawFineArc(startAngle, endAngle, radius, color, opacity) {
  const points = [];
  const segments = 40;
  for (let i = 0; i <= segments; i++) {
    const theta = startAngle + (i / segments) * (endAngle - startAngle);
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    blending: THREE.AdditiveBlending
  });
  const arc = new THREE.Line(geometry, material);
  filamentGroup.add(arc);
}

// ==========================================
// 5. INTERACTIVE POINTER INFRASTRUCTURE
// ==========================================
const raycaster = new THREE.Raycaster();
const mousePointer = new THREE.Vector2();
let targetedTrackObject = null;

raycaster.params.Points.threshold = 4.5;

const visualHudCard = document.createElement('div');
visualHudCard.style.cssText = `
  position: absolute;
  bottom: 40px;
  left: 40px;
  background: rgba(3, 8, 6, 0.9);
  border: 1px solid #00ffcc;
  padding: 22px;
  color: #ffffff;
  font-family: monospace;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 2px;
  box-shadow: 0 0 20px rgba(0, 255, 204, 0.15);
  z-index: 100;
`;
document.body.appendChild(visualHudCard);

window.addEventListener('mousemove', (event) => {
  mousePointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  mousePointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// ==========================================
// 6. AUDIO RECONNAISSANCE FRAMEWORK
// ==========================================
window.analyserDataArray = null;

function initializeAudioAnalysis() {
  const liveAudioElement = new Audio();
  liveAudioElement.src = "https://pub-99bbf9779b8f44d6b446cf564c84fd88.r2.dev/rainforest.wav";
  liveAudioElement.loop = true;
  liveAudioElement.crossOrigin = "anonymous";

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const srcNode = ctx.createMediaElementSource(liveAudioElement);
  const analyserNode = ctx.createAnalyser();
  srcNode.connect(analyserNode);
  analyserNode.connect(ctx.destination);
  analyserNode.fftSize = 512;
  liveAudioElement.src = 'https://pub-99bbf9779b8f44d6b446cf564c84fd88.r2.dev/rainforest.wav';
  const dataBufferLength = analyserNode.frequencyBinCount;
  const rawDataArray = new Uint8Array(dataBufferLength);
  window.analyserDataArray = rawDataArray;

  window.addEventListener('click', () => {
    if (ctx.state === 'suspended') ctx.resume();
    if (liveAudioElement.paused) {
      liveAudioElement.play()
        .then(() => console.log("🎵 Rainforest audio pipeline active & streaming frequencies."))
        .catch(e => console.warn("Audio playback bottlenecked:", e));
    }
  }, { once: true });

  function updateFrequencies() {
    requestAnimationFrame(updateFrequencies);
    if (window.analyserDataArray) {
      analyserNode.getByteFrequencyData(window.analyserDataArray);
    }
  }
  updateFrequencies();
}
initializeAudioAnalysis();

// ==========================================
// 7. DYNAMIC BIO-MATRIX ALIGNMENT ENGINE
// ==========================================
async function buildDynamicEcosystemMatrix() {
  const totalSegments = bigScrubEcosystem.length;
  const angleStep = (Math.PI * 2) / totalSegments;

  bigScrubEcosystem.forEach((specimen, i) => {
    const arcColor = specimen.origin === "Gondwana" ? 0x00ffcc : 0xff00aa;
    drawFineArc(i * angleStep, (i + 0.8) * angleStep, RING_RADIUS, arcColor, 0.15);
  });

  const loadPromises = bigScrubEcosystem.map(async (specimen, index) => {
    try {
      const response = await fetchFastaWithFallback(specimen);
      const rawText = await response.text();

      const sequences = rawText.split('\n')
        .filter(line => !line.startsWith('>') && line.trim() !== "")
        .join('')
        .toUpperCase();

      const seqLength = sequences.length;
      if (seqLength === 0) return;

      // FIXED: Standardized to use positions and colors cleanly to match your buffer allocation attributes
      const positions = [];
      const colors = [];
      const trackHeightY = (index - (totalSegments / 2)) * TRACK_SPACING;
      // Double-check safeguards to prevent any undefined state failures
      const isGondwana = specimen.origin === "Gondwana" || specimen.lineage === "Gondwana";
        let baseTrackColor = new THREE.Color();
          if (isGondwana) {
                baseTrackColor.setHSL(0.35 + (index * 0.001), 0.90, 0.45); // 🟢 Verified Gondwana Green
          } else {
                baseTrackColor.setHSL(0.55 + (index * 0.001), 0.95, 0.50); // 🔵 Verified Malesian Blue
          }

      for (let i = 0; i < seqLength; i++) {
        const nucleotide = sequences[i];
        const radialAngle = (i / seqLength) * Math.PI * 2;

        const x = Math.cos(radialAngle) * BASE_RADIUS;
        const z = Math.sin(radialAngle) * BASE_RADIUS;

        positions.push(x, trackHeightY, z);

        const pointColor = baseTrackColor.clone();
        if (nucleotide === '-' || nucleotide === 'N') {
          pointColor.multiplyScalar(0.15);
        } else if (nucleotide === 'A' || nucleotide === 'G') {
          pointColor.addScalar(0.15);
        }

        colors.push(pointColor.r, pointColor.g, pointColor.b);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      // Force-clear boundaries before binding
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const material = new THREE.PointsMaterial({
            size: 0.01,                     // 🌟 Shrinking the size stops the massive pixel overlapping
            vertexColors: true,
            transparent: true,
            opacity: 0.6,                    // Lower opacity allows beautiful sub-canopy layering
            blending: THREE.NormalBlending,  // 🌟 Switching to NormalBlending reveals the true green & blue hues!
            depthWrite: false
        });

      const structuralRing = new THREE.Points(geometry, material);

      structuralRing.userData = {
        name: `${specimen.genus} ${specimen.species}`,
        common: specimen.common,
        nativeY: trackHeightY,
        origin: specimen.origin,
        coppice: specimen.coppice,
        fleshy: specimen.fleshy
      };

      genomicMatrixGroup.add(structuralRing);

    } catch (err) {
      console.warn(`Asset warning [Track ${index}]: ${err.message}`);
    }
  });

  await Promise.all(loadPromises);
  console.log(`🧬 Dynamic Grid Core Online: ${genomicMatrixGroup.children.length} layers mapped.`);
}

buildDynamicEcosystemMatrix();

// ==========================================
// 8.
// Pass your active variables into the modular loader function
loadAndRenderEcosystemVectors(scene, projectCoordinates, boundaryVectorGroup, remnantVectorGroup);

// ==========================================

async function streamPotree2BinarySite(reserve) {
  // 🛡️ THE REMNANT ISOLATION SHIELD: Skip downloading if Isolate Mode is active and this isn't our target
  if (INSTAL_STATE.isolateMode && reserve.id !== INSTAL_STATE.activeReserveId) {
    console.log(`ℹ️ System Guard: Isolate Mode active. Skipping download for: ${reserve.name}`);
    return;
  }
  try {
    // 1. First, fetch and parse structural definitions
    const metaResponse = await fetch(`${reserve.dir}metadata.json`);
    if (!metaResponse.ok) throw new Error("metadata missing");
    const metadata = await metaResponse.json();

    // Resolve precise attributes directly from the completed metadata object
    const posAttr = metadata.attributes.find(a => a.name === 'position');
    const rgbAttr = metadata.attributes.find(a => a.name === 'rgb');
    const bytesPerPoint = metadata.bytesPerPoint || 35;

    // 2. Next, download the raw binary octree point buffer
    const octreeResponse = await fetch(`${reserve.dir}octree.bin`);
    if (!octreeResponse.ok) throw new Error("octree binary data missing");
    const binaryBuffer = await octreeResponse.arrayBuffer();
    const dataView = new DataView(binaryBuffer);

    const totalPointsCount = Math.floor(binaryBuffer.byteLength / bytesPerPoint);

    // 3. Configure stride decimation parameters to prevent hardware overloads
    const strideStep = totalPointsCount > 5000000 ? 50 : 10;
    const decimatedPointsCount = Math.floor(totalPointsCount / strideStep);

    console.log(`⏳ Streaming ${reserve.name}: Decimating down to ${decimatedPointsCount.toLocaleString()} points for memory safety...`);

    const posArray = new Float32Array(decimatedPointsCount * 3);
    const colArray = new Float32Array(decimatedPointsCount * 3);

    const globalOffset = projectCoordinates(reserve.coords.lon, reserve.coords.lat, 20000);

    // --- SAFE COORDINATE RESOLUTION & DEFENSIVE PARSING LOOP ---

    // Extract local bounding box minimum bounds from metadata
    const [tileMinX, tileMinY, tileMinZ] = metadata.boundingBox.min;

    // Resolve unified 1000-unit vector map destination floor coordinates
    const siteGeoPlacement = projectCoordinates(reserve.coords.lon, reserve.coords.lat, 1000);

    let targetIndex = 0;

     // 4. Run the data extraction loop
    for (let i = 0; i < totalPointsCount; i += strideStep) {
        if (targetIndex >= decimatedPointsCount) break;

        const offset = i * bytesPerPoint;
        const pOff = offset + posAttr.offset;

        const lx = (dataView.getInt32(pOff + 0, true) * metadata.scale[0]) || 0;
        const ly = (dataView.getInt32(pOff + 4, true) * metadata.scale[1]) || 0;
        const lz = (dataView.getInt32(pOff + 8, true) * metadata.scale[2]) || 0;

        const finalWorldX = lx + metadata.offset[0];
        const finalWorldY = ly + metadata.offset[1];
        const finalWorldZ = lz + metadata.offset[2];

        const writePtr = targetIndex * 3;
        posArray[writePtr + 0] = finalWorldX;
        posArray[writePtr + 1] = finalWorldY;
        posArray[writePtr + 2] = finalWorldZ;

        // 🎨 Procedural Color Generation (Placed safely inside the loop!)
        const heightRatio = Math.max(0, Math.min(1, (finalWorldZ + 10) / 40));
        
        // Grab audio data dynamically if available
        const audioIntensity = (typeof audioData !== 'undefined' && audioData.length > 0) 
            ? audioData[5] / 255 
            : 0.2;

        colArray[writePtr + 0] = 0.0; // Red
        colArray[writePtr + 1] = heightRatio * (0.6 + audioIntensity * 0.4); // Green
        colArray[writePtr + 2] = (1.0 - heightRatio) + (audioIntensity * 0.3); // Blue

        targetIndex++;
    }

    // 5. Build and force reset geometry attributes
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = new THREE.PointsMaterial({
      size: INSTAL_STATE.pointAesthetic.size,
      vertexColors: true,
      transparent: true,
      opacity: INSTAL_STATE.pointAesthetic.opacity,
      blending: INSTAL_STATE.pointAesthetic.blending ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    });


    const pointCloudReserveMesh = new THREE.Points(geometry, material);
    pointCloudReserveMesh.userData = { siteId: reserve.id, nativeBaseScale: 4.0 };

    mapGroup.add(pointCloudReserveMesh);
    loadedLandscapeRemnants.set(reserve.id, pointCloudReserveMesh);

    console.log(`✅ 🌲 Landscape Layer Rendered: ${reserve.name}`);
  } catch (err) {
    console.log(`ℹ️ Landscape Status Notice: Reserve ${reserve.id} awaiting data (${err.message}).`);
  }
}

// ==========================================
// 9. CORE RENDERING LOOP ENGINE
// ==========================================
function animationLoopEngine() {
  requestAnimationFrame(animationLoopEngine);

  controls.update();
  const time = Date.now() * 0.001;

  // --- Spatial Frequency Modulation for Volumetric Landscapes ---
  // --- Inside your active animationLoopEngine() frequency evaluator ---
  if (window.analyserDataArray) {
    // FIX: Add the bracket index [0] to extract a precise number value from the array
    const bassSignal = window.analyserDataArray[0] / 255;

    // Ensure canopySignal is tracking its index properly as well
    const highFreqCanopyIndex = Math.floor(window.analyserDataArray.length * 0.75);
    const canopySignal = window.analyserDataArray[highFreqCanopyIndex] / 255;

    // --- Inside your active animationLoopEngine() audio conditional block ---
    loadedLandscapeRemnants.forEach((cloudMesh) => {
      if (!cloudMesh || !cloudMesh.material) return;

      // 1. EXTRACT EXPLICIT INDICES NATIVELY TO PREVENT OBJECT CONFLICTS
      const rawBassByte = window.analyserDataArray ? window.analyserDataArray[0] : 0;
      const highFreqCanopyIndex = window.analyserDataArray ? Math.floor(window.analyserDataArray.length * 0.75) : 0;
      const rawCanopyByte = window.analyserDataArray ? window.analyserDataArray[highFreqCanopyIndex] : 0;

      // 2. HARDWARE NUMERICAL SAFETY GUARDS
      // If the audio context hasn't started yet, fall back to default stable 1.0 numbers
      const bassSignal = rawBassByte > 0 ? rawBassByte / 255 : 0.001;
      const canopySignal = rawCanopyByte > 0 ? rawCanopyByte / 255 : 0.001;

      // Pull tracking keys safely using an alternative logical fallback switch
      const secureSiteId = cloudMesh.userData.siteId || cloudMesh.userData.id || 1;

      // 3. EXECUTE SAFE WebGL TRANSFORMS
      cloudMesh.material.size = cloudMesh.userData.nativeBaseScale * (1.0 + canopySignal * 1.6);
      cloudMesh.material.needsUpdate = true;

      // Every single value in this formula is now guaranteed to be a clear, finite float number
      cloudMesh.position.y = Math.sin(time * 1.5 + secureSiteId) * 15.0 * bassSignal;
    });

    // --- Genomic Core Frequency Track Distribution ---
    genomicMatrixGroup.children.forEach((ring, index) => {
      const meta = ring.userData;
      const freqIdx = Math.floor((index / genomicMatrixGroup.children.length) * window.analyserDataArray.length);
      const audioSignal = window.analyserDataArray[freqIdx] / 255;

      const spinDir = index % 2 === 0 ? 1 : -1;
      ring.rotation.y += (0.0005 + audioSignal * 0.003) * spinDir;

      if (meta.fleshy) {
        const wave = Math.sin(time * 2.5 + meta.nativeY * 0.02) * 25.0 * audioSignal;
        ring.position.y = meta.nativeY + wave;
        ring.material.opacity = 0.3 + (audioSignal * 0.6);
      } else {
        if (meta.coppice) {
          ring.scale.setScalar(1.0 + audioSignal * 0.05);
        }
        ring.position.y = THREE.MathUtils.lerp(ring.position.y, meta.nativeY, 0.1);
        ring.material.opacity = 0.65;
      }
    });

    boundaryVectorGroup.rotation.y -= 0.0001;
    remnantVectorGroup.rotation.y -= 0.0001;
  } else {
    // Default fallback slow idle spin rotation if sound streams are paused
    genomicMatrixGroup.children.forEach((ring, index) => {
      ring.rotation.y += 0.001 * (index % 2 === 0 ? 1 : -1);
    });
    boundaryVectorGroup.rotation.y -= 0.00005;
    remnantVectorGroup.rotation.y -= 0.00005;

    loadedLandscapeRemnants.forEach((cloudMesh) => {
      cloudMesh.position.y = Math.sin(time * 0.5 + cloudMesh.userData.id) * 2.0;
    });
  }

  // --- HUD Pointer Calculations ---
  raycaster.setFromCamera(mousePointer, camera);
  const hitIntersections = raycaster.intersectObjects(genomicMatrixGroup.children);

  if (hitIntersections.length > 0) {
    const primaryHit = hitIntersections[0].object; // Clean tracking index target configuration

    if (targetedTrackObject !== primaryHit) {
      if (targetedTrackObject) targetedTrackObject.material.size = 1.5;

      targetedTrackObject = primaryHit;
      targetedTrackObject.material.size = 4.5;

      const data = targetedTrackObject.userData;
      visualHudCard.innerHTML =
        '<div style="color: #00ffcc; font-size: 10px; letter-spacing: 2px; margin-bottom: 6px;">INSTALLATION INTERACTION CORE</div>' +
        '<div style="font-size: 20px; font-weight: bold; font-style: italic; color: #fff;">' + data.name + '</div>' +
        '<div style="font-size: 14px; color: #88b0a5; margin-top: 4px;">Common Name: ' + data.common + '</div>' +
        '<div style="font-size: 11px; color: #aaa; margin-top: 8px; border-top: 1px solid #22443d; padding-top: 6px;">' +
        'Lineage: <span style="color: ' + (data.origin === "Gondwana" ? "#00ffcc" : "#ff00aa") + '">' + data.origin + '</span>' +
        '</div>';
      visualHudCard.style.opacity = "1";
    }
  } else {
    if (targetedTrackObject) {
      targetedTrackObject.material.size = 1.5;
      targetedTrackObject = null;
    }
    visualHudCard.style.opacity = "0";
  }

  renderer.render(scene, camera);
}
animationLoopEngine();
// ==========================================
// 10. HARDWARE SAFE SEQUENTIAL QUEUE PIPELINE
// ==========================================
async function loadLandscapeReservesSequentially() {
  console.log("⏳ Initialising Hardware-Safe Landscape Loader Queue...");

  for (const reserve of targetRainforestReserves) {
    // Awaits the absolute completion of the current reserve 
    // before allowing the next file stream to allocate memory.
    await streamPotree2BinarySite(reserve);

    // Tiny cooling delay to allow the garbage collector to flush memory buffers
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log("🌲 All available landscape remnants successfully stabilized.");
}

// Fire the hardware-safe sequential queue
loadLandscapeReservesSequentially();
