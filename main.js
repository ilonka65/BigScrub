import { bigScrubEcosystem } from './speciesConfig.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
const targetRainforestReserves = [
  { id: 1, name: "Victoria Park Nature Reserve",     coords: { lon: 153.41, lat: -28.90 }, dir: "./pointclouds/1/" },
  { id: 2, name: "Booyong Flora Reserve",           coords: { lon: 153.45, lat: -28.74 }, dir: "./pointclouds/2/" },
  { id: 3, name: "Big Scrub Flora Reserve",         coords: { lon: 153.24, lat: -28.69 }, dir: "./pointclouds/3/" },
  { id: 4, name: "Minyon Falls Nature Reserve",     coords: { lon: 153.38, lat: -28.62 }, dir: "./pointclouds/4/" },
  { id: 5, name: "Boomerang Falls Flora Reserve",   coords: { lon: 153.37, lat: -28.63 }, dir: "./pointclouds/5/" }
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
  const pathSpace = `./genetics/${specimen.genus} ${specimen.species} alignment.fasta`;
  const pathUnderscore = `./genetics/${specimen.genus}_${specimen.species} alignment.fasta`;

  let response = await fetch(pathSpace);
  if (response.ok) return response;

  response = await fetch(pathUnderscore);
  if (response.ok) return response;

  throw new Error(`FASTA missing: ${specimen.genus} ${specimen.species}`);
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
  liveAudioElement.src = 'sounds/rainforest.mp3'; 
  liveAudioElement.loop = true;
  liveAudioElement.crossOrigin = "anonymous";

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const srcNode = ctx.createMediaElementSource(liveAudioElement);
  const analyserNode = ctx.createAnalyser();
    srcNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);
    analyserNode.fftSize = 512;
    liveAudioElement.src = 'sounds/rainforest.wav';
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

      let baseTrackColor = new THREE.Color();
      if (specimen.origin === "Gondwana") {
        baseTrackColor.setHSL(0.35 + (index * 0.001), 0.90, 0.45); 
      } else {
        baseTrackColor.setHSL(0.55 + (index * 0.001), 0.95, 0.50); 
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
        size: 1.5, 
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
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
// 8. MAP VECTOR LAYER LOADER
// ==========================================
async function loadAndRenderEcosystemVectors() {
  try {
    const boundaryRes = await fetch('./boundary.geojson');
    if (boundaryRes.ok) {
      const boundaryData = await boundaryRes.json();
      const boundaryMaterial = new THREE.LineBasicMaterial({
        color: 0x334440, 
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
      });

      boundaryData.features.forEach(feature => {
        if (!feature.geometry) return;
        const coordinates = feature.geometry.coordinates;
        const rawLines = feature.geometry.type === "LineString" ? [coordinates] : coordinates.flat(3);

        const points = [];
        for (let i = 0; i < rawLines.length - 1; i += 2) {
          if (typeof rawLines[i] === 'number' && typeof rawLines[i+1] === 'number') {
            const projected = projectCoordinates(rawLines[i], rawLines[i+1], 1000);
            points.push(new THREE.Vector3(projected.x, -40, projected.z));
          }
        }
        if (points.length > 0) {
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geometry, boundaryMaterial);
          boundaryVectorGroup.add(line);
        }
      });
    }

    const remnantsRes = await fetch('./remnants.geojson');
    if (remnantsRes.ok) {
      const remnantsData = await remnantsRes.json();
      const remnantMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffcc, 
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });

remnantsData.features.forEach(feature => {
if (!feature.geometry) return;
const coordinates = feature.geometry.coordinates;
const rawLines = feature.geometry.type === "LineString" ? [coordinates] : coordinates.flat(3);
const points = [];
// --- FIX 1: Update the Historical Boundary loop projection line ---
for (let i = 0; i < rawLines.length - 1; i += 2) {
  if (typeof rawLines[i] === 'number' && typeof rawLines[i+1] === 'number') {
    // PASS THE ALTERNATING INDEX CHUNKS (i = longitude, i + 1 = latitude)
    const projected = projectCoordinates(rawLines[i], rawLines[i+1], 1000);
points.push(new THREE.Vector3(projected.x, -40, projected.z));
  }
}

// --- FIX 2: Update the Surviving Remnants loop projection line ---
for (let i = 0; i < rawLines.length - 1; i += 2) {
  if (typeof rawLines[i] === 'number' && typeof rawLines[i+1] === 'number') {
    // PASS THE ALTERNATING INDEX CHUNKS (i = longitude, i + 1 = latitude)
    const projected = projectCoordinates(rawLines[i], rawLines[i+1], 1000);
points.push(new THREE.Vector3(projected.x, -38, projected.z));
  }
}

if (points.length > 0) {
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const line = new THREE.Line(geometry, remnantMaterial);
remnantVectorGroup.add(line);
}
});
}
console.log('Map Layers Anchored: Boundary and Remnant vectors projected.');
} catch (error) {
console.warn('Map Layer Load Error:', error);
}
}
loadAndRenderEcosystemVectors();
window.addEventListener('resize', () => {
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(window.innerWidth, window.innerHeight);
});
async function streamPotree2BinarySite(reserve) {
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

        // --- REPLACE FROM HERE DOWN TO THE END OF THE FOR LOOP IN STREAMPOTREE2BINARYSITE ---

    // Array destructuring extracts indices safely without using any index numbers
    // This completely bypasses any hidden chat or markdown parsing filters!
    const [tileMinX, tileMinZ, tileMinY] = metadata.boundingBox.min;

    // Scale matches your unified 1000-unit vector map floor layout
    const siteGeoPlacement = projectCoordinates(reserve.coords.lon, reserve.coords.lat, 1000);
    
    let targetIndex = 0;

    for (let i = 0; i < totalPointsCount; i += strideStep) {
      if (targetIndex >= decimatedPointsCount) break;

      const offset = i * bytesPerPoint;
      const pOff = offset + posAttr.offset;
      
      const lx = (dataView.getInt32(pOff + 0, true) * metadata.scale) || 0;
      const ly = (dataView.getInt32(pOff + 4, true) * metadata.scale) || 0;
      const lz = (dataView.getInt32(pOff + 8, true) * metadata.scale) || 0;
      
      // --- PERFECT METRIC LOCALIZATION ---
      // 1. Subtract the tile's own absolute minimum to isolate a tight 0-2000m local grid
      // 2. Scale down by 0.05 to turn a 2000m grid into a neat 100-unit canopy model
      const localizedX = (lx - tileMinX) * 0.05;
      const localizedZ = (ly - tileMinZ) * 0.05;
      const localizedY = (lz - tileMinY) * 0.05;
      
      // 3. Anchor your local 100-unit canopy models cleanly onto their geographic markers
      posArray[targetIndex * 3]     = localizedX + siteGeoPlacement.x;
      posArray[targetIndex * 3 + 1] = localizedY - 40; // Flat alignment clearance below core
      posArray[targetIndex * 3 + 2] = localizedZ + siteGeoPlacement.z;
      
      if (rgbAttr) {
        const cOff = offset + rgbAttr.offset;
        colArray[targetIndex * 3]     = dataView.getUint8(cOff + 0) / 255;
        colArray[targetIndex * 3 + 1] = dataView.getUint8(cOff + 1) / 255; 
        colArray[targetIndex * 3 + 2] = dataView.getUint8(cOff + 2) / 255;
      }
      
      targetIndex++;
    }

    // 4. Run the data extraction loop (Safely positioned AFTER all variables are initialized!)
    for (let i = 0; i < totalPointsCount; i += strideStep) {
      if (targetIndex >= decimatedPointsCount) break;

      const offset = i * bytesPerPoint;
      const pOff = offset + posAttr.offset;
      
      const lx = (dataView.getInt32(pOff + 0, true) * metadata.scale) || 0;
      const ly = (dataView.getInt32(pOff + 4, true) * metadata.scale) || 0;
      const lz = (dataView.getInt32(pOff + 8, true) * metadata.scale) || 0;
      
      const scaledX = (lx - 538000) * 0.05;
      const scaledZ = (ly - 6800000) * 0.05;
      const siteGeoPlacement = projectCoordinates(reserve.coords.lon, reserve.coords.lat, 20000);
    
      posArray[targetIndex * 3]     = scaledX + siteGeoPlacement.x;
    posArray[targetIndex * 3 + 1] = (lz * 0.05) - 590; // Downscale the elevation height cleanly
    posArray[targetIndex * 3 + 2] = scaledZ + siteGeoPlacement.z;
      
      if (rgbAttr) {
        const cOff = offset + rgbAttr.offset;
        colArray[targetIndex * 3]     = dataView.getUint8(cOff + 0) / 255;
        colArray[targetIndex * 3 + 1] = dataView.getUint8(cOff + 2) / 255; 
        colArray[targetIndex * 3 + 2] = dataView.getUint8(cOff + 1) / 255;
      }
      
      targetIndex++;
    }
    
    // 5. Build and force reset geometry attributes
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colArray, 3));
    
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    const material = new THREE.PointsMaterial({
      size: 4.0, 
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
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
