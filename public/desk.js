/* =========================================================
   AMEBA Desk – Main Desk Manager (PanelSurface-based)
   ========================================================= */

import { DESK_PROFILES } from './desk-types.js';
import {
  normalizedToPx,
  pxToNormalized,
  rectToPx,
  clampToZone,
  applySnap
} from './desk-geometry.js';
import {
  loadDeskState,
  saveDeskState,
  getInitialObjects
} from './desk-store.js';

// Constants
const DEFAULT_OBJECT_WIDTH = 180;
const DEFAULT_OBJECT_HEIGHT = 140;
const MAT_EXCLUSION_PADDING = 8;

/**
 * Desk class manages the zone, objects, and interactions
 * Now uses PanelSurface primitive for placement
 */
export class Desk {
  constructor(panelSurface, options = {}) {
    // Use PanelSurface instead of direct container
    this.panelSurface = panelSurface;
    this.container = panelSurface.element;
    
    this.profileId = options.profileId || 'workshop_L';
    this.profile = DESK_PROFILES[this.profileId];
    
    // State
    this.objects = [];
    this.pixelRects = [];
    this.maxZ = 0;
    this.dragState = null;
    this.objectIdCounter = 0;
    
    // Load saved state or use initial objects
    const saved = loadDeskState();
    if (saved && saved.objects && saved.objects.length > 0) {
      this.objects = saved.objects;
      this.maxZ = Math.max(...this.objects.map(o => o.z), 0);
    } else {
      this.objects = getInitialObjects();
      this.maxZ = Math.max(...this.objects.map(o => o.z), 0);
    }
    
    // Setup
    this.init();
  }
  
  init() {
    // Create desk surface (tabletop)
    this.surface = document.createElement('div');
    this.surface.className = 'ameba-desk-surface';
    this.container.appendChild(this.surface);
    
    // Create mat/tray area (bottom inset)
    this.mat = document.createElement('div');
    this.mat.className = 'desk-mat';
    this.surface.appendChild(this.mat);
    
    // Create source icons in mat
    this.createMatIcons();
    
    // Measure and calculate pixel rects
    this.updateGeometry();
    
    // Render objects
    this.render();
    
    // Setup resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.updateGeometry();
      this.render();
    });
    this.resizeObserver.observe(this.container);
    
    // Auto-save on changes
    this.autoSaveDebounced = this.debounce(() => this.save(), 500);
  }
  
  updateGeometry() {
    const rect = this.surface.getBoundingClientRect();
    this.zoneWidth = rect.width;
    this.zoneHeight = rect.height;
    
    // Get desk and mat rect helpers
    this.deskRect = this.getDeskRectPx();
    this.matRect = this.getMatRectPx();
    
    // Convert normalized rects to pixel rects
    this.pixelRects = this.profile.shape.rects.map(r =>
      rectToPx(r, this.zoneWidth, this.zoneHeight, this.profile.padding)
    );
  }
  
  /**
   * Get desk surface bounds in pixels
   * @returns {{x: number, y: number, w: number, h: number}}
   */
  getDeskRectPx() {
    const rect = this.surface.getBoundingClientRect();
    return {
      x: 0,
      y: 0,
      w: rect.width,
      h: rect.height
    };
  }
  
  /**
   * Get mat area bounds in pixels (relative to desk surface)
   * @returns {{x: number, y: number, w: number, h: number}}
   */
  getMatRectPx() {
    if (!this.mat) return { x: 0, y: 0, w: 0, h: 0 };
    
    const surfaceRect = this.surface.getBoundingClientRect();
    const matRect = this.mat.getBoundingClientRect();
    
    return {
      x: matRect.left - surfaceRect.left,
      y: matRect.top - surfaceRect.top,
      w: matRect.width,
      h: matRect.height
    };
  }
  
  /**
   * Create source icons in the mat area
   */
  createMatIcons() {
    const icons = [
      { id: 'sticky', emoji: '📝', type: 'note', label: 'Note' },
      { id: 'notebook', emoji: '📓', type: 'note', label: 'Notebook' },
      { id: 'calendar', emoji: '📅', type: 'calendar', label: 'Calendar' },
      { id: 'file', emoji: '📄', type: 'note', label: 'File' }
    ];
    
    icons.forEach(icon => {
      const btn = document.createElement('button');
      btn.className = 'mat-icon';
      btn.dataset.iconType = icon.type;
      btn.dataset.iconId = icon.id;
      btn.setAttribute('aria-label', icon.label);
      btn.textContent = icon.emoji;
      
      // Click to spawn
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.spawnObjectFromIcon(icon);
      });
      
      // Drag from icon
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.startDragFromIcon(e, icon);
      });
      
      this.mat.appendChild(btn);
    });
  }
  
  /**
   * Generate unique object ID
   */
  generateObjectId(type) {
    return `${type}-${Date.now()}-${++this.objectIdCounter}`;
  }
  
  /**
   * Spawn a new object from a mat icon (click)
   */
  spawnObjectFromIcon(icon) {
    // Position object just above the mat
    const matRect = this.getMatRectPx();
    const padding = 16;
    
    // Calculate position in pixels (centered above mat)
    const px = (this.zoneWidth - DEFAULT_OBJECT_WIDTH) / 2;
    const py = matRect.y - DEFAULT_OBJECT_HEIGHT - padding;
    
    // Convert to normalized coordinates
    const normalized = pxToNormalized(
      px,
      py,
      this.zoneWidth,
      this.zoneHeight,
      this.profile.padding
    );
    
    // Create object
    const newObj = {
      id: this.generateObjectId(icon.type),
      type: icon.type,
      label: icon.label,
      size: { w: DEFAULT_OBJECT_WIDTH, h: DEFAULT_OBJECT_HEIGHT },
      pos: { nx: normalized.nx, ny: normalized.ny },
      z: ++this.maxZ,
      payload: icon.type === 'note' ? { content: '', color: '#a78bfa' } : {}
    };
    
    this.objects.push(newObj);
    this.render();
    this.save();
  }
  
  /**
   * Start dragging a new object from a mat icon
   */
  startDragFromIcon(e, icon) {
    // Create new object at pointer position
    const surfaceRect = this.surface.getBoundingClientRect();
    
    const px = e.clientX - surfaceRect.left - DEFAULT_OBJECT_WIDTH / 2;
    const py = e.clientY - surfaceRect.top - DEFAULT_OBJECT_HEIGHT / 2;
    
    // Convert to normalized coordinates
    const normalized = pxToNormalized(
      px,
      py,
      this.zoneWidth,
      this.zoneHeight,
      this.profile.padding
    );
    
    // Create object
    const newObj = {
      id: this.generateObjectId(icon.type),
      type: icon.type,
      label: icon.label,
      size: { w: DEFAULT_OBJECT_WIDTH, h: DEFAULT_OBJECT_HEIGHT },
      pos: { nx: normalized.nx, ny: normalized.ny },
      z: ++this.maxZ,
      payload: icon.type === 'note' ? { content: '', color: '#a78bfa' } : {}
    };
    
    this.objects.push(newObj);
    this.render();
    
    // Immediately start dragging the new object
    const el = this.surface.querySelector(`[data-id="${newObj.id}"]`);
    if (el) {
      // Trigger drag manually
      this.startObjectDrag(el, newObj, e);
    }
  }
  
  /**
   * Helper to start dragging an object programmatically
   */
  startObjectDrag(el, obj, initialEvent) {
    const startX = initialEvent.clientX;
    const startY = initialEvent.clientY;
    
    const rect = el.getBoundingClientRect();
    const initialLeft = rect.left - this.surface.getBoundingClientRect().left;
    const initialTop = rect.top - this.surface.getBoundingClientRect().top;
    
    el.classList.add('is-dragging');
    
    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newX = initialLeft + dx;
      let newY = initialTop + dy;
      
      // Clamp to desk zone, excluding mat
      const clamped = this.clampToDeskExcludingMat(newX, newY, obj.size.w, obj.size.h);
      
      // Apply snap
      const snapped = applySnap(clamped.x, clamped.y, this.profile.snap);
      
      el.style.left = `${snapped.x}px`;
      el.style.top = `${snapped.y}px`;
    };
    
    const onMouseUp = (e) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      // Update normalized position
      const currentLeft = parseFloat(el.style.left);
      const currentTop = parseFloat(el.style.top);
      
      const normalized = pxToNormalized(
        currentLeft,
        currentTop,
        this.zoneWidth,
        this.zoneHeight,
        this.profile.padding
      );
      
      obj.pos.nx = normalized.nx;
      obj.pos.ny = normalized.ny;
      
      el.classList.remove('is-dragging');
      this.autoSaveDebounced();
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  
  /**
   * Clamp object position to desk zone, preventing overlap with mat
   */
  clampToDeskExcludingMat(x, y, objWidth, objHeight) {
    const deskRect = this.deskRect;
    const matRect = this.matRect;
    
    // First clamp to desk bounds
    let clampedX = Math.max(deskRect.x, Math.min(x, deskRect.x + deskRect.w - objWidth));
    let clampedY = Math.max(deskRect.y, Math.min(y, deskRect.y + deskRect.h - objHeight));
    
    // Check if object overlaps mat
    const objRect = {
      x: clampedX,
      y: clampedY,
      w: objWidth,
      h: objHeight
    };
    
    if (this.rectsOverlap(objRect, matRect)) {
      // Position object above mat
      clampedY = matRect.y - objHeight - MAT_EXCLUSION_PADDING;
      
      // Ensure it's still within desk bounds
      clampedY = Math.max(deskRect.y, clampedY);
    }
    
    return { x: clampedX, y: clampedY };
  }
  
  /**
   * Check if two rectangles overlap
   */
  rectsOverlap(rect1, rect2) {
    return !(rect1.x + rect1.w < rect2.x ||
             rect2.x + rect2.w < rect1.x ||
             rect1.y + rect1.h < rect2.y ||
             rect2.y + rect2.h < rect1.y);
  }
  
  render() {
    // Clear existing object elements
    this.surface.querySelectorAll('.desk-object').forEach(el => el.remove());
    
    // Sort by z-index
    const sorted = [...this.objects].sort((a, b) => a.z - b.z);
    
    // Render each object
    sorted.forEach(obj => {
      const el = this.createObjectElement(obj);
      this.surface.appendChild(el);
    });
  }
  
  createObjectElement(obj) {
    const el = document.createElement('div');
    el.className = `desk-object desk-object--${obj.type}`;
    el.dataset.id = obj.id;
    el.style.zIndex = obj.z;
    
    // Convert normalized position to pixels
    const pos = normalizedToPx(
      obj.pos.nx,
      obj.pos.ny,
      this.zoneWidth,
      this.zoneHeight,
      this.profile.padding
    );
    
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
    el.style.width = `${obj.size.w}px`;
    el.style.height = `${obj.size.h}px`;
    
    // Create content based on type
    const content = this.renderObjectContent(obj);
    el.innerHTML = content;
    
    // Add event listeners
    this.attachObjectListeners(el, obj);
    
    return el;
  }
  
  renderObjectContent(obj) {
    const iconMap = {
      note: '📝',
      calendar: '📅',
      checklist: '✓',
      timer: '⏱',
      shortcut: '⚡'
    };
    
    const icon = iconMap[obj.type] || '📄';
    
    let body = '';
    if (obj.type === 'note' && obj.payload.content) {
      body = `<div class="desk-object__note">${obj.payload.content.split('\n')[0]}</div>`;
    } else if (obj.type === 'checklist' && obj.payload.items) {
      const items = obj.payload.items.slice(0, 3);
      body = `<div class="desk-object__checklist">
        ${items.map(item => `
          <div class="desk-object__checklist-item">
            <span class="desk-object__checkbox ${item.done ? 'checked' : ''}"></span>
            <span>${item.text}</span>
          </div>
        `).join('')}
      </div>`;
    }
    
    return `
      <div class="desk-object__header">
        <span class="desk-object__icon">${icon}</span>
        <span class="desk-object__label">${obj.label}</span>
      </div>
      ${body}
    `;
  }
  
  attachObjectListeners(el, obj) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    let clickTime = 0;
    
    const onMouseDown = (e) => {
      if (e.target.closest('.desk-object__checkbox')) return;
      
      clickTime = Date.now();
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = el.getBoundingClientRect();
      initialLeft = rect.left - this.surface.getBoundingClientRect().left;
      initialTop = rect.top - this.surface.getBoundingClientRect().top;
      
      // Bring to front
      this.bringToFront(obj.id);
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      
      e.preventDefault();
    };
    
    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      // If moved more than 3px, consider it a drag
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDragging = true;
      }
      
      if (isDragging) {
        let newX = initialLeft + dx;
        let newY = initialTop + dy;
        
        // Clamp to desk zone, excluding mat
        const clamped = this.clampToDeskExcludingMat(newX, newY, obj.size.w, obj.size.h);
        
        // Apply snap
        const snapped = applySnap(clamped.x, clamped.y, this.profile.snap);
        
        el.style.left = `${snapped.x}px`;
        el.style.top = `${snapped.y}px`;
        
        el.classList.add('is-dragging');
      }
    };
    
    const onMouseUp = (e) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      if (isDragging) {
        // Update normalized position
        const currentLeft = parseFloat(el.style.left);
        const currentTop = parseFloat(el.style.top);
        
        const normalized = pxToNormalized(
          currentLeft,
          currentTop,
          this.zoneWidth,
          this.zoneHeight,
          this.profile.padding
        );
        
        obj.pos.nx = normalized.nx;
        obj.pos.ny = normalized.ny;
        
        el.classList.remove('is-dragging');
        this.autoSaveDebounced();
      } else {
        // This was a click, not a drag
        const timeSinceMouseDown = Date.now() - clickTime;
        if (timeSinceMouseDown < 300) {
          this.handleObjectClick(obj);
        }
      }
      
      isDragging = false;
    };
    
    el.addEventListener('mousedown', onMouseDown);
  }
  
  bringToFront(objectId) {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return;
    
    this.maxZ++;
    obj.z = this.maxZ;
    
    const el = this.surface.querySelector(`[data-id="${objectId}"]`);
    if (el) {
      el.style.zIndex = this.maxZ;
    }
    
    this.autoSaveDebounced();
  }
  
  handleObjectClick(obj) {
    // Dispatch custom event for Q3 Projection panel integration
    window.dispatchEvent(new CustomEvent('ameba:desk-open', {
      detail: { objectId: obj.id, object: obj }
    }));
    
    console.log('[desk] Opening object:', obj.id, obj.type);
  }
  
  switchProfile(profileId) {
    if (!DESK_PROFILES[profileId]) {
      console.warn('[desk] Unknown profile:', profileId);
      return;
    }
    
    this.profileId = profileId;
    this.profile = DESK_PROFILES[profileId];
    this.updateGeometry();
    this.render();
    this.save();
  }
  
  addObject(type, label, payload = {}) {
    const newObj = {
      id: this.generateObjectId(type),
      type,
      label,
      size: { w: DEFAULT_OBJECT_WIDTH, h: DEFAULT_OBJECT_HEIGHT },
      pos: { nx: 0.1 + Math.random() * 0.3, ny: 0.1 + Math.random() * 0.3 },
      z: ++this.maxZ,
      payload
    };
    
    this.objects.push(newObj);
    this.render();
    this.save();
    
    return newObj;
  }
  
  removeObject(objectId) {
    const index = this.objects.findIndex(o => o.id === objectId);
    if (index !== -1) {
      this.objects.splice(index, 1);
      this.render();
      this.save();
    }
  }
  
  save() {
    saveDeskState(this.profileId, this.objects);
  }
  
  debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }
  
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
