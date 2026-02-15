/* =========================================================
   AMEBA Layout Kernel – Single Source of Truth for Layout
   ========================================================= */

/**
 * @typedef {'workshop' | 'platform'} PageType
 * @typedef {'topNav' | 'leftRail' | | 'leftDock' | 'centerStage' | 'rightRail' | 'bottomRail' | 'dockEdge'} ZoneId
 * @typedef {'desk' | 'canvas' | 'storage' | 'queue' | 'awareness' | 'heroTitle' | 'influence'} PanelId
 */

/**
 * @typedef {Object} ZoneRect
 * @property {number} x - Normalized x (0..1)
 * @property {number} y - Normalized y (0..1)
 * @property {number} w - Normalized width (0..1)
 * @property {number} h - Normalized height (0..1)
 */

/**
 * @typedef {Object} ZoneDef
 * @property {ZoneId} id - Zone identifier
 * @property {ZoneRect[]} rects - Array of rectangles (supports union shapes)
 * @property {number} paddingPx - Padding in pixels
 */

/**
 * @typedef {Object} LayoutProfile
 * @property {PageType} pageType - Type of page
 * @property {Record<ZoneId, ZoneDef>} zones - Zone definitions
 * @property {Record<ZoneId, PanelId>} mountMap - Panel-to-zone assignments
 */

/**
 * @typedef {Object} PanelDef
 * @property {PanelId} id - Panel identifier
 * @property {string} displayName - Human-readable name
 * @property {string} elementId - DOM element ID
 * @property {boolean} [required] - Whether panel must always be mounted
 */

// ============================================================
// PANEL REGISTRY - What panels exist in the system
// ============================================================

/** @type {Record<PanelId, PanelDef>} */
export const PANEL_REGISTRY = {
  awareness: {
    id: 'awareness',
    displayName: 'Awareness Lane',
    elementId: 'awarenessLane',
    required: false
  },
  canvas: {
    id: 'canvas',
    displayName: 'Canvas',
    elementId: 'inkPool',
    required: true
  },
  desk: {
    id: 'desk',
    displayName: 'Desk',
    elementId: 'deskPanel',
    required: true
  },
  storage: {
    id: 'storage',
    displayName: 'Storage',
    elementId: 'storagePanel',
    required: false
  },
  queue: {
    id: 'queue',
    displayName: 'Queue',
    elementId: 'queueDock',
    required: false
  },
heroTitle: {
  id: 'heroTitle',
  displayName: 'Hero Title',
  elementId: 'heroTitle',      // <section id="heroTitle">...</section>
  required: false
},
influence: {
  id: 'influence',
  displayName: 'Your Influence',
  elementId: 'influencePanel', // <section id="influencePanel">...</section>
  required: false
},

};

// ============================================================
// LAYOUT PROFILES - Zone definitions per page type
// ============================================================

/** @type {Record<PageType, LayoutProfile>} */
export const LAYOUT_PROFILES = {
  // WORKSHOP PAGE: awareness left, canvas center, header+influence top-right, desk right, storage bottom
workshop: {
  pageType: 'workshop',
  zones: {
    topNav: {
      id: 'topNav',
      rects: [{ x: 0.077, y: 0.0, w: 0.923, h: 0.053 }],
      paddingPx: 0
    },

    leftRail: {
      id: 'leftRail',
      rects: [{ x: 0.08, y: 0.12, w: 0.114, h: 0.64 }],
      paddingPx: 12
    },

    // Queue moved back under awareness (separate zone)
    leftDock: {
      id: 'leftDock',
      rects: [{ x: 0.08, y: 0.78, w: 0.114, h: 0.12 }],
      paddingPx: 12
    },

    centerStage: {
      id: 'centerStage',
      rects: [{ x: 0.296, y: 0.176, w: 0.322, h: 0.572 }],
      paddingPx: 16
    },

    // NEW: Hero title sits above the right side of canvas, NOT inside desk
    heroTitle: {
      id: 'heroTitle',
      rects: [{ x: 0.445, y: 0.051, w: 0.286, h: 0.093 }],
      paddingPx: 0
    },

    // NEW: Your Influence panel aligned with hero row
    influence: {
      id: 'influence',
      rects: [{ x: 0.765, y: 0.05, w: 0.083, h: 0.11 }],
      paddingPx: 12
    },

    // Desk-only column
    rightRail: {
      id: 'rightRail',
      rects: [{ x: 0.717, y: 0.173, w: 0.134, h: 0.574 }],
      paddingPx: 0
    },

    bottomRail: {
      id: 'bottomRail',
      rects: [{ x: 0.113, y: 0.9, w: 0.887, h: 0.1 }],
      paddingPx: 12
    }
  },

  mountMap: {
    leftRail: 'awareness',
    leftDock: 'queue',
    centerStage: 'canvas',
    heroTitle: 'heroTitle',
    influence: 'influence',
    rightRail: 'desk',
    bottomRail: 'storage'
  }
},

  hero: {
    id: 'hero',
    displayName: 'Hero Title',
    elementId: 'heroTitle',
    required: false
  },
  influence: {
    id: 'influence',
    displayName: 'Your Influence',
    elementId: 'influencePanel',
    required: false
  },


  // PLATFORM PAGE: 4-quadrant layout with desk in larger quadrant
  platform: {
    pageType: 'platform',
    zones: {
      topNav: {
        id: 'topNav',
        rects: [{ x: 0, y: 0, w: 1, h: 0.08 }],
        paddingPx: 0
      },
      leftRail: {
        id: 'leftRail',
        rects: [{ x: 0, y: 0.08, w: 0.40, h: 0.60 }],
        paddingPx: 16
      },
      centerStage: {
        id: 'centerStage',
        rects: [{ x: 0.40, y: 0.08, w: 0.60, h: 0.60 }],
        paddingPx: 16
      },
      rightRail: {
        id: 'rightRail',
        rects: [{ x: 0, y: 0.68, w: 0.40, h: 0.32 }],
        paddingPx: 16
      },
      bottomRail: {
        id: 'bottomRail',
        rects: [{ x: 0.40, y: 0.68, w: 0.60, h: 0.32 }],
        paddingPx: 16
      },
      dockEdge: {
        id: 'dockEdge',
        rects: [{ x: 0, y: 0.95, w: 1, h: 0.05 }],
        paddingPx: 8
      }
    },
    mountMap: {
      leftRail: 'canvas',
      centerStage: 'desk',
      rightRail: 'storage',
      bottomRail: 'queue',
      dockEdge: 'dock'
    }
  }
};

// ============================================================
// LAYOUT KERNEL - Core layout engine
// ============================================================

export class LayoutKernel {
  constructor() {
    /** @type {PageType} */
    this.currentPageType = 'workshop';
    
    /** @type {LayoutProfile} */
    this.currentProfile = LAYOUT_PROFILES.workshop;
    
    /** @type {Map<PanelId, HTMLElement>} */
    this.panelElements = new Map();
    
    /** @type {Map<ZoneId, HTMLElement>} */
    this.zoneElements = new Map();
  }

  /**
   * Initialize the layout kernel
   * @param {PageType} pageType - Initial page type
   */
  init(pageType = 'workshop') {
    this.currentPageType = pageType;
    this.currentProfile = LAYOUT_PROFILES[pageType];
    
    console.log('[LayoutKernel] Initialized with page type:', pageType);
    
    // Discover panel elements
    this.discoverPanels();
    
    // Create zone containers
    this.createZones();
    
    // Mount panels to zones
    this.mountPanels();
  }

  /**
   * Discover and register panel elements from DOM
   */
  discoverPanels() {
    for (const [panelId, panelDef] of Object.entries(PANEL_REGISTRY)) {
      const element = document.getElementById(panelDef.elementId);
      if (element) {
        this.panelElements.set(panelId, element);
        console.log(`[LayoutKernel] Discovered panel: ${panelId}`);
      } else if (panelDef.required) {
        console.warn(`[LayoutKernel] Required panel not found: ${panelId}`);
      }
    }
  }

  /**
   * Create zone container elements
   */
  createZones() {
    // Container should be .shell or main element with position: relative
    const container = document.querySelector('.shell') || document.querySelector('main');
    if (!container) {
      throw new Error('[LayoutKernel] No layout container found. Ensure .shell or main element exists.');
    }

    // Clear existing zones
    const existingZones = container.querySelectorAll('.layout-zone');
    existingZones.forEach(zone => zone.remove());

    // Create zones based on current profile
    for (const [zoneId, zoneDef] of Object.entries(this.currentProfile.zones)) {
      const zoneElement = document.createElement('div');
      zoneElement.className = 'layout-zone';
      zoneElement.dataset.zoneId = zoneId;
      zoneElement.id = `zone-${zoneId}`;
      
      // Apply normalized positioning
      this.applyZoneGeometry(zoneElement, zoneDef);
      
      this.zoneElements.set(zoneId, zoneElement);
      container.appendChild(zoneElement);
      
      console.log(`[LayoutKernel] Created zone: ${zoneId}`);
    }
  }

  /**
   * Apply zone geometry to element
   * @param {HTMLElement} element - Zone element
   * @param {ZoneDef} zoneDef - Zone definition
   */
  applyZoneGeometry(element, zoneDef) {
    if (!zoneDef.rects || zoneDef.rects.length === 0) {
      console.error('[LayoutKernel] Zone has no rects defined');
      return;
    }
    
    // For now, use the first rect (multi-rect union support can be added later)
    const rect = zoneDef.rects[0];
    
    element.style.position = 'absolute';
    element.style.left = `${rect.x * 100}%`;
    element.style.top = `${rect.y * 100}%`;
    element.style.width = `${rect.w * 100}%`;
    element.style.height = `${rect.h * 100}%`;
    element.style.padding = `${zoneDef.paddingPx}px`;
    element.style.boxSizing = 'border-box';
  }

  /**
   * Mount panels to their assigned zones
   */
  mountPanels() {
    const { mountMap } = this.currentProfile;
    
    for (const [zoneId, panelId] of Object.entries(mountMap)) {
      const zoneElement = this.zoneElements.get(zoneId);
      const panelElement = this.panelElements.get(panelId);
      
      if (zoneElement && panelElement) {
        // Mount panel to zone
        zoneElement.appendChild(panelElement);
        panelElement.classList.add('panel-mounted');
        panelElement.dataset.mountedZone = zoneId;
        
        console.log(`[LayoutKernel] Mounted ${panelId} to ${zoneId}`);
      } else {
        if (!zoneElement) {
          console.warn(`[LayoutKernel] Zone not found: ${zoneId}`);
        }
        if (!panelElement) {
          console.warn(`[LayoutKernel] Panel not found: ${panelId}`);
        }
      }
    }
  }

  /**
   * Switch to a different page type
   * @param {PageType} pageType - Target page type
   */
  switchPageType(pageType) {
    if (this.currentPageType === pageType) {
      return;
    }
    
    console.log(`[LayoutKernel] Switching from ${this.currentPageType} to ${pageType}`);
    
    this.currentPageType = pageType;
    this.currentProfile = LAYOUT_PROFILES[pageType];
    
    // Recreate layout
    this.createZones();
    this.mountPanels();
  }

  /**
   * Get zone definition for a panel
   * @param {PanelId} panelId - Panel identifier
   * @returns {ZoneDef|null}
   */
  getZoneForPanel(panelId) {
    const { mountMap, zones } = this.currentProfile;
    
    for (const [zoneId, mappedPanelId] of Object.entries(mountMap)) {
      if (mappedPanelId === panelId) {
        return zones[zoneId];
      }
    }
    
    return null;
  }
}

// ============================================================
// PANEL SURFACE - Generic primitive for all panels
// ============================================================

export class PanelSurface {
  /**
   * Create a panel surface
   * @param {PanelId} panelId - Panel identifier
   * @param {LayoutKernel} layoutKernel - Layout kernel instance
   */
  constructor(panelId, layoutKernel) {
    this.panelId = panelId;
    this.layoutKernel = layoutKernel;
    this.panelDef = PANEL_REGISTRY[panelId];
    
    if (!this.panelDef) {
      throw new Error(`Unknown panel: ${panelId}`);
    }
    
    this.element = document.getElementById(this.panelDef.elementId);
    if (!this.element) {
      throw new Error(`Panel element not found: ${this.panelDef.elementId}`);
    }
    
    this.zoneDef = null;
    this.updateZoneInfo();
  }

  /**
   * Update zone information from layout kernel
   */
  updateZoneInfo() {
    this.zoneDef = this.layoutKernel.getZoneForPanel(this.panelId);
    if (this.zoneDef) {
      console.log(`[PanelSurface:${this.panelId}] Mounted in zone: ${this.zoneDef.id}`);
    } else {
      // Dev warning: Panel not mounted to any zone
      try {
        const isDev = (
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.port !== ''
        );
        if (isDev) {
          console.warn(`[PanelSurface:${this.panelId}] ⚠️  Panel is not mounted to any zone in current layout!`);
        }
      } catch (e) {
        // Silently ignore if environment check fails
      }
    }
  }

  /**
   * Get the current zone geometry
   * @returns {ZoneRect|null}
   */
  getZoneGeometry() {
    if (!this.zoneDef || !this.zoneDef.rects.length) {
      return null;
    }
    return this.zoneDef.rects[0];
  }

  /**
   * Get pixel dimensions of the zone
   * @returns {{width: number, height: number}|null}
   */
  getPixelDimensions() {
    if (!this.element) return null;
    
    const rect = this.element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height
    };
  }

  /**
   * Check if panel is currently mounted
   * @returns {boolean}
   */
  isMounted() {
    return this.element.classList.contains('panel-mounted');
  }
}

// ============================================================
// LAYOUT KERNEL FACTORY
// ============================================================

/**
 * Create a new LayoutKernel instance
 * @param {PageType} pageType - Initial page type
 * @returns {LayoutKernel}
 */
export function createLayoutKernel(pageType = 'workshop') {
  const kernel = new LayoutKernel();
  kernel.init(pageType);
  return kernel;
}

// Make classes and factory available globally
if (typeof window !== 'undefined') {
  window.LayoutKernel = LayoutKernel;
  window.PanelSurface = PanelSurface;
  window.createLayoutKernel = createLayoutKernel;
  window.LAYOUT_PROFILES = LAYOUT_PROFILES;
  window.PANEL_REGISTRY = PANEL_REGISTRY;
  
  // Create singleton for convenience (can be replaced by user)
  window.layoutKernel = null;
}
