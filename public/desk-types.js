/* =========================================================
   AMEBA Desk – Type definitions & Zone Profiles
   ========================================================= */

/**
 * @typedef {Object} DeskRect
 * @property {number} x - Normalized x (0..1)
 * @property {number} y - Normalized y (0..1)
 * @property {number} w - Normalized width (0..1)
 * @property {number} h - Normalized height (0..1)
 */

/**
 * @typedef {Object} DeskZoneProfile
 * @property {string} id - Profile ID
 * @property {Object} shape - Shape definition
 * @property {('rect'|'L')} shape.kind - Shape type
 * @property {DeskRect[]} shape.rects - Array of normalized rectangles
 * @property {number} padding - Pixel padding applied after scaling
 * @property {Object} [snap] - Optional snap settings
 * @property {number} [snap.grid] - Grid size in pixels
 * @property {boolean} [snap.enabled] - Whether snapping is enabled
 */

/**
 * @typedef {Object} DeskObject
 * @property {string} id - Unique ID
 * @property {('note'|'calendar'|'checklist'|'timer'|'shortcut')} type - Object type
 * @property {string} label - Display label
 * @property {Object} size - Size in pixels
 * @property {number} size.w - Width
 * @property {number} size.h - Height
 * @property {Object} pos - Normalized position
 * @property {number} pos.nx - Normalized x (0..1)
 * @property {number} pos.ny - Normalized y (0..1)
 * @property {number} z - Z-index for layering
 * @property {Object} payload - Type-specific data
 */

/**
 * Predefined desk zone profiles
 */
export const DESK_PROFILES = {
  /**
   * Workshop L-shape: Two connected rectangles forming an L
   * Top rect spans full width, bottom rect on the right
   */
  workshop_L: {
    id: "workshop_L",
    shape: {
      kind: "L",
      rects: [
        { x: 0, y: 0, w: 1, h: 0.4 },      // Top horizontal bar (full width)
        { x: 0.5, y: 0.4, w: 0.5, h: 0.6 } // Right vertical bar (right half)
      ]
    },
    padding: 12,
    snap: { grid: 8, enabled: true }
  },

  /**
   * Quadrants top: Single rectangle in the top portion
   */
  quadrants_top: {
    id: "quadrants_top",
    shape: {
      kind: "rect",
      rects: [
        { x: 0, y: 0, w: 1, h: 0.6 } // Top 60% of the zone
      ]
    },
    padding: 12,
    snap: { grid: 8, enabled: true }
  },

  /**
   * Full rectangle: Uses the entire zone space
   */
  full_rect: {
    id: "full_rect",
    shape: {
      kind: "rect",
      rects: [
        { x: 0, y: 0, w: 1, h: 1 } // Entire zone
      ]
    },
    padding: 12,
    snap: { grid: 8, enabled: true }
  }
};
