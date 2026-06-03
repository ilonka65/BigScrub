// src/Config.js

export const INSTAL_STATE = {
  // SET TO "true" TO TURN OFF UNWANTED REMNANTS AND RESTORE YOUR CORRECT SCALE!
  isolateMode: true,           
  activeReserveId: 1,          // 1: Victoria Park, 2: Booyong, 3: Big Scrub, etc.

  // TOGGLES: Turn off the massive 75,000 hectares regional map layer completely
  showMacroBoundaries: false,  
  showGenomicRing: true,      

  // JAMES MCGRATH & GARY SINCLAIR CINEMATIC AESTHETICS
  pointAesthetic: {
    size: 0.03,                // Fine, ghostly museum-grade point sizing
    opacity: 0.70,
    additiveBlending: true     // Overlapping points blend and glow softly
  }
};
