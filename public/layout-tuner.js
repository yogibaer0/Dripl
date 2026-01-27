/* =========================================================
   AMEBA Layout Tuner – Developer-only Layout Editor
   ========================================================= */

/**
 * Layout Tuner - Developer overlay for adjusting zone layouts
 * 
 * Features:
 * - Toggle with Ctrl+Shift+L or DEV button
 * - Visual zone outlines + labels
 * - Draggable zone edges for resizing
 * - Live profile updates
 * - Copy JSON to clipboard
 * - Reset to defaults
 * - Save to localStorage
 * 
 * @requires LayoutKernel
 */

// Only enable in development
const isDev = (() => {
  // Check for dev environment indicators
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port !== '' ||
    localStorage.getItem('AMEBA_DEV_MODE') === 'true'
  );
})();

if (!isDev) {
  console.log('[LayoutTuner] Disabled in production');
  // Export no-op for production
  if (typeof window !== 'undefined') {
    window.LayoutTuner = class {
      constructor() {}
      enable() {}
      disable() {}
    };
  }
} else {

// ============================================================
// CONSTANTS
// ============================================================

const TUNER_HOTKEY = 'KeyL';
const TUNER_MODIFIERS = ['ctrlKey', 'shiftKey'];
const DRAG_THRESHOLD = 3; // pixels
const EDGE_THRESHOLD = 8; // pixels to detect edge
const MIN_ZONE_SIZE = 0.05; // minimum 5% size

const TUNER_STYLES = `
.layout-tuner-active .layout-zone {
  outline: 2px solid rgba(167, 139, 250, 0.6);
  outline-offset: -2px;
  position: relative;
  pointer-events: auto;
}

.layout-tuner-active .layout-zone::before {
  content: attr(data-zone-id);
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(139, 92, 246, 0.9);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 10000;
}

.layout-tuner-panel {
  position: fixed;
  top: 100px;
  right: 20px;
  width: 320px;
  background: rgba(22, 22, 37, 0.98);
  border: 2px solid rgba(167, 139, 250, 0.4);
  border-radius: 12px;
  padding: 16px;
  z-index: 100000;
  font-family: ui-sans-serif, system-ui, sans-serif;
  color: #e8e7ff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.layout-tuner-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.2);
}

.layout-tuner-panel__title {
  font-size: 14px;
  font-weight: 600;
  color: #a78bfa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.layout-tuner-panel__close {
  background: none;
  border: none;
  color: #a7a7c9;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.layout-tuner-panel__close:hover {
  background: rgba(167, 139, 250, 0.2);
  color: #fff;
}

.layout-tuner-panel__section {
  margin-bottom: 16px;
}

.layout-tuner-panel__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #a7a7c9;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.layout-tuner-panel__select {
  width: 100%;
  background: rgba(20, 20, 39, 0.8);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 6px;
  color: #e8e7ff;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.layout-tuner-panel__select:hover {
  border-color: rgba(167, 139, 250, 0.5);
}

.layout-tuner-panel__select:focus {
  outline: none;
  border-color: #a78bfa;
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
}

.layout-tuner-panel__button {
  width: 100%;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 6px;
  color: #a78bfa;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
}

.layout-tuner-panel__button:hover {
  background: rgba(139, 92, 246, 0.25);
  border-color: rgba(167, 139, 250, 0.5);
  color: #fff;
}

.layout-tuner-panel__button:active {
  transform: scale(0.98);
}

.layout-tuner-panel__button--primary {
  background: #8b5cf6;
  border-color: #8b5cf6;
  color: white;
}

.layout-tuner-panel__button--primary:hover {
  background: #7c3aed;
  border-color: #7c3aed;
}

.layout-tuner-panel__button--danger {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.layout-tuner-panel__button--danger:hover {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.5);
}

.layout-tuner-panel__info {
  font-size: 11px;
  color: #a7a7c9;
  line-height: 1.4;
  background: rgba(167, 139, 250, 0.05);
  padding: 8px;
  border-radius: 4px;
  margin-top: 8px;
}

.layout-tuner-panel__coordinates {
  font-size: 11px;
  font-family: 'Courier New', monospace;
  color: #a7a7c9;
  background: rgba(20, 20, 39, 0.8);
  padding: 8px;
  border-radius: 4px;
  margin-top: 8px;
  white-space: pre;
  overflow-x: auto;
}

.layout-tuner-dev-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 48px;
  height: 48px;
  background: rgba(139, 92, 246, 0.9);
  border: 2px solid rgba(167, 139, 250, 0.4);
  border-radius: 50%;
  color: white;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
  transition: all 0.2s;
}

.layout-tuner-dev-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 24px rgba(139, 92, 246, 0.6);
}

.layout-tuner-dev-button:active {
  transform: scale(0.95);
}

.layout-zone-resizing {
  cursor: move !important;
}

.layout-zone-resize-edge {
  cursor: ew-resize !important;
}

.layout-zone-resize-edge-v {
  cursor: ns-resize !important;
}
`;

// ============================================================
// LAYOUT TUNER CLASS
// ============================================================

export class LayoutTuner {
  constructor(layoutKernel) {
    if (!layoutKernel) {
      throw new Error('[LayoutTuner] LayoutKernel instance required');
    }

    this.layoutKernel = layoutKernel;
    this.enabled = false;
    this.panel = null;
    this.devButton = null;
    this.styleElement = null;
    
    // Drag state
    this.dragState = {
      active: false,
      zoneId: null,
      edge: null, // 'left', 'right', 'top', 'bottom'
      startX: 0,
      startY: 0,
      startRect: null,
      container: null
    };

    // Store original profiles for reset
    this.defaultProfiles = JSON.parse(JSON.stringify(window.LAYOUT_PROFILES || {}));
    
    this.init();
  }

  init() {
    console.log('[LayoutTuner] Initializing developer overlay');
    
    // Inject styles
    this.injectStyles();
    
    // Create dev button
    this.createDevButton();
    
    // Setup hotkey
    this.setupHotkey();
    
    // Load saved state
    this.loadSavedState();
  }

  injectStyles() {
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = TUNER_STYLES;
    document.head.appendChild(this.styleElement);
  }

  createDevButton() {
    this.devButton = document.createElement('button');
    this.devButton.className = 'layout-tuner-dev-button';
    this.devButton.textContent = 'L';
    this.devButton.title = 'Layout Tuner (Ctrl+Shift+L)';
    this.devButton.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.devButton);
  }

  setupHotkey() {
    document.addEventListener('keydown', (e) => {
      const modifiersMatch = TUNER_MODIFIERS.every(mod => e[mod]);
      if (modifiersMatch && e.code === TUNER_HOTKEY) {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle() {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  enable() {
    if (this.enabled) return;
    
    console.log('[LayoutTuner] Enabling tuner overlay');
    this.enabled = true;
    
    // Add active class to show zone outlines
    document.body.classList.add('layout-tuner-active');
    
    // Create control panel
    this.createPanel();
    
    // Setup zone interaction
    this.setupZoneInteraction();
  }

  disable() {
    if (!this.enabled) return;
    
    console.log('[LayoutTuner] Disabling tuner overlay');
    this.enabled = false;
    
    document.body.classList.remove('layout-tuner-active');
    
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    
    this.cleanupZoneInteraction();
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'layout-tuner-panel';
    
    const currentPageType = this.layoutKernel.currentPageType;
    
    this.panel.innerHTML = `
      <div class="layout-tuner-panel__header">
        <div class="layout-tuner-panel__title">Layout Tuner</div>
        <button class="layout-tuner-panel__close" aria-label="Close">×</button>
      </div>
      
      <div class="layout-tuner-panel__section">
        <div class="layout-tuner-panel__label">Page Type</div>
        <select class="layout-tuner-panel__select" id="tuner-page-type">
          <option value="workshop" ${currentPageType === 'workshop' ? 'selected' : ''}>Workshop</option>
          <option value="platform" ${currentPageType === 'platform' ? 'selected' : ''}>Platform</option>
        </select>
      </div>
      
      <div class="layout-tuner-panel__section">
        <div class="layout-tuner-panel__label">Actions</div>
        <button class="layout-tuner-panel__button layout-tuner-panel__button--primary" id="tuner-copy-json">
          📋 Copy JSON
        </button>
        <button class="layout-tuner-panel__button" id="tuner-save-local">
          💾 Save to localStorage
        </button>
        <button class="layout-tuner-panel__button layout-tuner-panel__button--danger" id="tuner-reset">
          🔄 Reset to Defaults
        </button>
      </div>
      
      <div class="layout-tuner-panel__section">
        <div class="layout-tuner-panel__info">
          💡 Drag zone edges to resize. Changes update live.
          <br><br>
          Press <strong>Ctrl+Shift+L</strong> to toggle tuner.
        </div>
      </div>
      
      <div id="tuner-coordinates"></div>
    `;
    
    document.body.appendChild(this.panel);
    
    // Setup event listeners
    this.panel.querySelector('.layout-tuner-panel__close').addEventListener('click', () => {
      this.disable();
    });
    
    this.panel.querySelector('#tuner-page-type').addEventListener('change', (e) => {
      this.switchPageType(e.target.value);
    });
    
    this.panel.querySelector('#tuner-copy-json').addEventListener('click', () => {
      this.copyJSON();
    });
    
    this.panel.querySelector('#tuner-save-local').addEventListener('click', () => {
      this.saveToLocalStorage();
    });
    
    this.panel.querySelector('#tuner-reset').addEventListener('click', () => {
      this.resetToDefaults();
    });
  }

  setupZoneInteraction() {
    // Add mouse event listeners to zones
    this.layoutKernel.zoneElements.forEach((element, zoneId) => {
      element.style.pointerEvents = 'auto';
      
      // Mouse move to detect edges
      element.addEventListener('mousemove', (e) => this.handleZoneMouseMove(e, zoneId));
      
      // Mouse down to start drag
      element.addEventListener('mousedown', (e) => this.handleZoneMouseDown(e, zoneId));
    });
    
    // Document-level listeners for dragging
    this.boundMouseMove = (e) => this.handleDocumentMouseMove(e);
    this.boundMouseUp = (e) => this.handleDocumentMouseUp(e);
    
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  cleanupZoneInteraction() {
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
    }
    if (this.boundMouseUp) {
      document.removeEventListener('mouseup', this.boundMouseUp);
    }
  }

  handleZoneMouseMove(e, zoneId) {
    if (this.dragState.active) return;
    
    const element = this.layoutKernel.zoneElements.get(zoneId);
    if (!element) return;
    
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Detect which edge we're near
    let edge = null;
    if (x < EDGE_THRESHOLD) edge = 'left';
    else if (x > rect.width - EDGE_THRESHOLD) edge = 'right';
    else if (y < EDGE_THRESHOLD) edge = 'top';
    else if (y > rect.height - EDGE_THRESHOLD) edge = 'bottom';
    
    // Update cursor
    element.classList.remove('layout-zone-resize-edge', 'layout-zone-resize-edge-v');
    if (edge === 'left' || edge === 'right') {
      element.classList.add('layout-zone-resize-edge');
    } else if (edge === 'top' || edge === 'bottom') {
      element.classList.add('layout-zone-resize-edge-v');
    }
  }

  handleZoneMouseDown(e, zoneId) {
    const element = this.layoutKernel.zoneElements.get(zoneId);
    if (!element) return;
    
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Detect which edge we're dragging
    let edge = null;
    if (x < EDGE_THRESHOLD) edge = 'left';
    else if (x > rect.width - EDGE_THRESHOLD) edge = 'right';
    else if (y < EDGE_THRESHOLD) edge = 'top';
    else if (y > rect.height - EDGE_THRESHOLD) edge = 'bottom';
    
    if (!edge) return;
    
    e.preventDefault();
    
    // Get container dimensions
    const container = element.parentElement;
    const containerRect = container.getBoundingClientRect();
    
    // Get current zone definition
    const zoneDef = this.layoutKernel.currentProfile.zones[zoneId];
    if (!zoneDef || !zoneDef.rects || !zoneDef.rects[0]) return;
    
    this.dragState = {
      active: true,
      zoneId,
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...zoneDef.rects[0] },
      container: containerRect
    };
    
    element.classList.add('layout-zone-resizing');
  }

  handleDocumentMouseMove(e) {
    if (!this.dragState.active) return;
    
    e.preventDefault();
    
    const { zoneId, edge, startX, startY, startRect, container } = this.dragState;
    
    // Calculate delta in normalized coordinates
    const deltaX = (e.clientX - startX) / container.width;
    const deltaY = (e.clientY - startY) / container.height;
    
    // Calculate new rect based on edge
    const newRect = { ...startRect };
    
    switch (edge) {
      case 'left':
        newRect.x = Math.max(0, Math.min(startRect.x + startRect.w - MIN_ZONE_SIZE, startRect.x + deltaX));
        newRect.w = startRect.w - (newRect.x - startRect.x);
        break;
      case 'right':
        newRect.w = Math.max(MIN_ZONE_SIZE, Math.min(1 - startRect.x, startRect.w + deltaX));
        break;
      case 'top':
        newRect.y = Math.max(0, Math.min(startRect.y + startRect.h - MIN_ZONE_SIZE, startRect.y + deltaY));
        newRect.h = startRect.h - (newRect.y - startRect.y);
        break;
      case 'bottom':
        newRect.h = Math.max(MIN_ZONE_SIZE, Math.min(1 - startRect.y, startRect.h + deltaY));
        break;
    }
    
    // Update zone definition
    this.updateZoneRect(zoneId, newRect);
    
    // Update coordinate display
    this.updateCoordinateDisplay(zoneId, newRect);
  }

  handleDocumentMouseUp(e) {
    if (!this.dragState.active) return;
    
    const { zoneId } = this.dragState;
    const element = this.layoutKernel.zoneElements.get(zoneId);
    if (element) {
      element.classList.remove('layout-zone-resizing', 'layout-zone-resize-edge', 'layout-zone-resize-edge-v');
    }
    
    this.dragState = {
      active: false,
      zoneId: null,
      edge: null,
      startX: 0,
      startY: 0,
      startRect: null,
      container: null
    };
  }

  updateZoneRect(zoneId, newRect) {
    // Update the profile
    const zoneDef = this.layoutKernel.currentProfile.zones[zoneId];
    if (!zoneDef) return;
    
    zoneDef.rects[0] = newRect;
    
    // Apply to DOM
    const element = this.layoutKernel.zoneElements.get(zoneId);
    if (element) {
      this.layoutKernel.applyZoneGeometry(element, zoneDef);
    }
  }

  updateCoordinateDisplay(zoneId, rect) {
    const coordsEl = this.panel?.querySelector('#tuner-coordinates');
    if (!coordsEl) return;
    
    coordsEl.className = 'layout-tuner-panel__coordinates';
    coordsEl.textContent = `${zoneId}:
x: ${rect.x.toFixed(3)}
y: ${rect.y.toFixed(3)}
w: ${rect.w.toFixed(3)}
h: ${rect.h.toFixed(3)}`;
  }

  switchPageType(pageType) {
    this.layoutKernel.switchPageType(pageType);
    
    // Re-setup zone interaction with new zones
    this.cleanupZoneInteraction();
    this.setupZoneInteraction();
    
    console.log('[LayoutTuner] Switched to page type:', pageType);
  }

  copyJSON() {
    const profile = this.layoutKernel.currentProfile;
    
    // Format the zones for export
    const exportData = {
      pageType: profile.pageType,
      zones: {}
    };
    
    // Copy zones with formatted rects
    for (const [zoneId, zoneDef] of Object.entries(profile.zones)) {
      exportData.zones[zoneId] = {
        id: zoneDef.id,
        rects: zoneDef.rects.map(r => ({
          x: parseFloat(r.x.toFixed(3)),
          y: parseFloat(r.y.toFixed(3)),
          w: parseFloat(r.w.toFixed(3)),
          h: parseFloat(r.h.toFixed(3))
        })),
        paddingPx: zoneDef.paddingPx
      };
    }
    
    const json = JSON.stringify(exportData, null, 2);
    
    // Copy to clipboard
    navigator.clipboard.writeText(json).then(() => {
      console.log('[LayoutTuner] JSON copied to clipboard');
      this.showNotification('✓ JSON copied to clipboard');
    }).catch(err => {
      console.error('[LayoutTuner] Failed to copy:', err);
      this.showNotification('✗ Failed to copy JSON');
    });
  }

  saveToLocalStorage() {
    const profiles = {
      workshop: window.LAYOUT_PROFILES.workshop,
      platform: window.LAYOUT_PROFILES.platform
    };
    
    localStorage.setItem('AMEBA_LAYOUT_PROFILES', JSON.stringify(profiles));
    console.log('[LayoutTuner] Saved to localStorage');
    this.showNotification('✓ Saved to localStorage');
  }

  loadSavedState() {
    const saved = localStorage.getItem('AMEBA_LAYOUT_PROFILES');
    if (!saved) return;
    
    try {
      const profiles = JSON.parse(saved);
      
      // Merge saved profiles
      if (profiles.workshop) {
        Object.assign(window.LAYOUT_PROFILES.workshop.zones, profiles.workshop.zones);
      }
      if (profiles.platform) {
        Object.assign(window.LAYOUT_PROFILES.platform.zones, profiles.platform.zones);
      }
      
      console.log('[LayoutTuner] Loaded saved profiles from localStorage');
    } catch (e) {
      console.error('[LayoutTuner] Failed to load saved profiles:', e);
    }
  }

  resetToDefaults() {
    if (!confirm('Reset all zones to default values? This will clear your saved changes.')) {
      return;
    }
    
    // Restore from defaults
    window.LAYOUT_PROFILES.workshop = JSON.parse(JSON.stringify(this.defaultProfiles.workshop));
    window.LAYOUT_PROFILES.platform = JSON.parse(JSON.stringify(this.defaultProfiles.platform));
    
    // Clear localStorage
    localStorage.removeItem('AMEBA_LAYOUT_PROFILES');
    
    // Re-apply current profile
    this.layoutKernel.currentProfile = window.LAYOUT_PROFILES[this.layoutKernel.currentPageType];
    this.layoutKernel.createZones();
    this.layoutKernel.mountPanels();
    
    // Re-setup interaction
    this.cleanupZoneInteraction();
    this.setupZoneInteraction();
    
    console.log('[LayoutTuner] Reset to defaults');
    this.showNotification('✓ Reset to defaults');
  }

  showNotification(message) {
    // Simple notification - could be enhanced
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(139, 92, 246, 0.95);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      z-index: 1000000;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
}

// ============================================================
// EXPORT
// ============================================================

// Make available globally
if (typeof window !== 'undefined') {
  window.LayoutTuner = LayoutTuner;
  
  // Auto-initialize with global layoutKernel if available
  // (will be created after layoutKernel is initialized)
  window.initLayoutTuner = function() {
    if (window.layoutKernel && !window.layoutTuner) {
      window.layoutTuner = new LayoutTuner(window.layoutKernel);
      console.log('[LayoutTuner] Auto-initialized');
    }
  };
}

} // end isDev check
