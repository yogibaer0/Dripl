/* =========================================================
   AMEBA Desk – Geometry & Constraint Utilities
   ========================================================= */

/**
 * Convert normalized coordinates to pixel coordinates
 * @param {number} nx - Normalized x (0..1)
 * @param {number} ny - Normalized y (0..1)
 * @param {number} zoneWidth - Zone width in pixels
 * @param {number} zoneHeight - Zone height in pixels
 * @param {number} padding - Padding in pixels
 * @returns {{x: number, y: number}}
 */
export function normalizedToPx(nx, ny, zoneWidth, zoneHeight, padding = 0) {
  const innerWidth = zoneWidth - (padding * 2);
  const innerHeight = zoneHeight - (padding * 2);
  
  return {
    x: padding + (nx * innerWidth),
    y: padding + (ny * innerHeight)
  };
}

/**
 * Convert pixel coordinates to normalized coordinates
 * @param {number} x - Pixel x
 * @param {number} y - Pixel y
 * @param {number} zoneWidth - Zone width in pixels
 * @param {number} zoneHeight - Zone height in pixels
 * @param {number} padding - Padding in pixels
 * @returns {{nx: number, ny: number}}
 */
export function pxToNormalized(x, y, zoneWidth, zoneHeight, padding = 0) {
  const innerWidth = zoneWidth - (padding * 2);
  const innerHeight = zoneHeight - (padding * 2);
  
  const nx = Math.max(0, Math.min(1, (x - padding) / innerWidth));
  const ny = Math.max(0, Math.min(1, (y - padding) / innerHeight));
  
  return { nx, ny };
}

/**
 * Convert normalized rect to pixel rect
 * @param {Object} rect - Normalized rectangle {x, y, w, h}
 * @param {number} zoneWidth - Zone width in pixels
 * @param {number} zoneHeight - Zone height in pixels
 * @param {number} padding - Padding in pixels
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function rectToPx(rect, zoneWidth, zoneHeight, padding = 0) {
  const innerWidth = zoneWidth - (padding * 2);
  const innerHeight = zoneHeight - (padding * 2);
  
  return {
    x: padding + (rect.x * innerWidth),
    y: padding + (rect.y * innerHeight),
    w: rect.w * innerWidth,
    h: rect.h * innerHeight
  };
}

/**
 * Check if a point is inside a rectangle
 * @param {number} px - Point x
 * @param {number} py - Point y
 * @param {Object} rect - Rectangle {x, y, w, h}
 * @returns {boolean}
 */
export function isPointInRect(px, py, rect) {
  return px >= rect.x &&
         px <= rect.x + rect.w &&
         py >= rect.y &&
         py <= rect.y + rect.h;
}

/**
 * Check if a point is inside any of the zone's rectangles
 * @param {number} px - Point x in pixels
 * @param {number} py - Point y in pixels
 * @param {Object[]} pixelRects - Array of pixel rectangles
 * @returns {boolean}
 */
export function isPointInZone(px, py, pixelRects) {
  return pixelRects.some(rect => isPointInRect(px, py, rect));
}

/**
 * Clamp a point to the nearest valid position within the zone
 * @param {number} px - Point x in pixels
 * @param {number} py - Point y in pixels
 * @param {number} objWidth - Object width in pixels
 * @param {number} objHeight - Object height in pixels
 * @param {Object[]} pixelRects - Array of pixel rectangles defining the zone
 * @returns {{x: number, y: number}}
 */
export function clampToZone(px, py, objWidth, objHeight, pixelRects) {
  // For each rect, calculate the clamped position
  let bestX = px;
  let bestY = py;
  let minDist = Infinity;
  
  for (const rect of pixelRects) {
    // Clamp the object's top-left corner to stay within the rect
    const clampedX = Math.max(rect.x, Math.min(px, rect.x + rect.w - objWidth));
    const clampedY = Math.max(rect.y, Math.min(py, rect.y + rect.h - objHeight));
    
    // Calculate distance from original position
    const dist = Math.sqrt(
      Math.pow(clampedX - px, 2) + 
      Math.pow(clampedY - py, 2)
    );
    
    // Use the closest valid position
    if (dist < minDist) {
      minDist = dist;
      bestX = clampedX;
      bestY = clampedY;
    }
  }
  
  return { x: bestX, y: bestY };
}

/**
 * Apply snap-to-grid if enabled
 * @param {number} value - Value to snap
 * @param {number} gridSize - Grid size in pixels
 * @returns {number}
 */
export function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a position to grid if snap is enabled
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {Object} snapConfig - Snap configuration {grid, enabled}
 * @returns {{x: number, y: number}}
 */
export function applySnap(x, y, snapConfig) {
  if (!snapConfig || !snapConfig.enabled) {
    return { x, y };
  }
  
  return {
    x: snapToGrid(x, snapConfig.grid),
    y: snapToGrid(y, snapConfig.grid)
  };
}
