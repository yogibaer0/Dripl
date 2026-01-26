/* =========================================================
   AMEBA Desk – Main Desk Manager
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

/**
 * Desk class manages the zone, objects, and interactions
 */
export class Desk {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.profileId = options.profileId || 'workshop_L';
    this.profile = DESK_PROFILES[this.profileId];
    
    // State
    this.objects = [];
    this.pixelRects = [];
    this.maxZ = 0;
    this.dragState = null;
    
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
    // Create desk surface
    this.surface = document.createElement('div');
    this.surface.className = 'desk-surface';
    this.container.appendChild(this.surface);
    
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
    
    // Convert normalized rects to pixel rects
    this.pixelRects = this.profile.shape.rects.map(r =>
      rectToPx(r, this.zoneWidth, this.zoneHeight, this.profile.padding)
    );
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
        
        // Clamp to zone
        const clamped = clampToZone(
          newX,
          newY,
          obj.size.w,
          obj.size.h,
          this.pixelRects
        );
        
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
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      label,
      size: { w: 180, h: 140 },
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
