// src/MapController.js
import * as THREE from 'three';
import { INSTAL_STATE } from './Config.js';

export async function loadAndRenderEcosystemVectors(scene, projectCoordinates, boundaryVectorGroup, remnantVectorGroup) {
  // 🛡️ THE VISIBILITY SHIELD: If dashboard toggle is false, exit immediately and hide the layers!
  if (!INSTAL_STATE.showMacroBoundaries) {
    console.log('ℹ️ MapController: Macro boundaries are hidden via dashboard state.');
    return;
  }

  try {
    // 1. Process Historical Regional Boundaries
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

    // 2. Process Surviving Remnants Layer
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

        for (let i = 0; i < rawLines.length - 1; i += 2) {
          if (typeof rawLines[i] === 'number' && typeof rawLines[i+1] === 'number') {
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
