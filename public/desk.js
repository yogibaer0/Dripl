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
  getInitialObjects,
  getDefaultWorkspaceLabel
} from './desk-store.js';

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
    
    // Load saved state or use initial objects
    const saved = loadDeskState();
    if (saved && saved.objects && saved.objects.length > 0) {
      this.objects = saved.objects;
      this.maxZ = Math.max(...this.objects.map(o => o.z), 0);
      this.workspaceLabel = saved.workspaceLabel || getDefaultWorkspaceLabel();
    } else {
      this.objects = getInitialObjects();
      this.maxZ = Math.max(...this.objects.map(o => o.z), 0);
      this.workspaceLabel = getDefaultWorkspaceLabel();
    }
    
    // Setup
    this.init();
  }
  
  init() {
    // Create header rail
    this.createHeaderRail();
    
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
  
  createHeaderRail() {
    // Create header rail container
    this.headerRail = document.createElement('div');
    this.headerRail.className = 'desk-header-rail';
    
    // Left section: Your Influence button
    const leftSection = document.createElement('div');
    leftSection.className = 'desk-header-left';
    
    const profileBtn = document.createElement('button');
    profileBtn.className = 'desk-profile-btn';
    profileBtn.innerHTML = `
      <svg viewBox="0 0 24 24" class="desk-profile-icon" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="currentColor" opacity="0.85"/>
        <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="currentColor" opacity="0.65"/>
      </svg>
      <span>Your Influence</span>
    `;
    profileBtn.title = "Your Influence profile (coming soon)";
    profileBtn.addEventListener('click', () => {
      console.log('[desk] Your Influence clicked - stub');
      // TODO: Open profile overlay/modal
    });
    
    leftSection.appendChild(profileBtn);
    
    // Center section: Editable workspace label
    const centerSection = document.createElement('div');
    centerSection.className = 'desk-header-center';
    
    this.workspaceLabelEl = document.createElement('div');
    this.workspaceLabelEl.className = 'desk-workspace-label';
    this.workspaceLabelEl.textContent = this.workspaceLabel.text;
    this.applyWorkspaceLabelStyles();
    
    // Edit icon
    const editIcon = document.createElement('button');
    editIcon.className = 'desk-label-edit-icon';
    editIcon.innerHTML = '✎';
    editIcon.title = 'Edit workspace label';
    editIcon.addEventListener('click', () => this.openLabelEditor());
    
    centerSection.appendChild(this.workspaceLabelEl);
    centerSection.appendChild(editIcon);
    
    // Double-click to edit
    this.workspaceLabelEl.addEventListener('dblclick', () => this.openLabelEditor());
    
    // Assemble header
    this.headerRail.appendChild(leftSection);
    this.headerRail.appendChild(centerSection);
    
    // Add to container
    this.container.appendChild(this.headerRail);
  }
  
  applyWorkspaceLabelStyles() {
    if (!this.workspaceLabelEl) return;
    
    this.workspaceLabelEl.style.fontSize = `${this.workspaceLabel.fontSize}px`;
    this.workspaceLabelEl.style.fontWeight = this.workspaceLabel.fontWeight;
    this.workspaceLabelEl.style.letterSpacing = `${this.workspaceLabel.letterSpacing}em`;
    
    if (this.workspaceLabel.fontFamily) {
      this.workspaceLabelEl.style.fontFamily = this.workspaceLabel.fontFamily;
    } else {
      this.workspaceLabelEl.style.fontFamily = '';
    }
  }
  
  openLabelEditor() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'desk-label-editor-modal';
    
    const editor = document.createElement('div');
    editor.className = 'desk-label-editor';
    
    editor.innerHTML = `
      <div class="desk-label-editor-header">
        <h3>Edit Workspace Label</h3>
        <button class="desk-label-editor-close">×</button>
      </div>
      
      <div class="desk-label-editor-body">
        <div class="desk-label-field">
          <label>Text</label>
          <input type="text" class="desk-label-text" value="${this.workspaceLabel.text}" maxlength="50" />
        </div>
        
        <div class="desk-label-field">
          <label>Font Size (px)</label>
          <input type="range" class="desk-label-fontsize" min="14" max="28" value="${this.workspaceLabel.fontSize}" />
          <span class="desk-label-fontsize-value">${this.workspaceLabel.fontSize}px</span>
        </div>
        
        <div class="desk-label-field">
          <label>Font Weight</label>
          <select class="desk-label-fontweight">
            <option value="400" ${this.workspaceLabel.fontWeight === 400 ? 'selected' : ''}>Normal (400)</option>
            <option value="500" ${this.workspaceLabel.fontWeight === 500 ? 'selected' : ''}>Medium (500)</option>
            <option value="600" ${this.workspaceLabel.fontWeight === 600 ? 'selected' : ''}>Semibold (600)</option>
            <option value="700" ${this.workspaceLabel.fontWeight === 700 ? 'selected' : ''}>Bold (700)</option>
          </select>
        </div>
        
        <div class="desk-label-field">
          <label>Letter Spacing (em)</label>
          <input type="range" class="desk-label-letterspacing" min="0" max="0.2" step="0.01" value="${this.workspaceLabel.letterSpacing}" />
          <span class="desk-label-letterspacing-value">${this.workspaceLabel.letterSpacing}em</span>
        </div>
        
        <div class="desk-label-field">
          <label>Font Family (optional)</label>
          <select class="desk-label-fontfamily">
            <option value="">Default</option>
            <option value="Inter, sans-serif" ${this.workspaceLabel.fontFamily === 'Inter, sans-serif' ? 'selected' : ''}>Inter</option>
            <option value="Roboto, sans-serif" ${this.workspaceLabel.fontFamily === 'Roboto, sans-serif' ? 'selected' : ''}>Roboto</option>
            <option value="monospace" ${this.workspaceLabel.fontFamily === 'monospace' ? 'selected' : ''}>Monospace</option>
          </select>
        </div>
        
        <div class="desk-label-preview">
          <div class="desk-label-preview-text">${this.workspaceLabel.text}</div>
        </div>
      </div>
      
      <div class="desk-label-editor-footer">
        <button class="btn btn-ghost desk-label-cancel">Cancel</button>
        <button class="btn btn--primary desk-label-save">Save</button>
      </div>
    `;
    
    modal.appendChild(editor);
    document.body.appendChild(modal);
    
    // Get elements
    const textInput = editor.querySelector('.desk-label-text');
    const fontSizeInput = editor.querySelector('.desk-label-fontsize');
    const fontSizeValue = editor.querySelector('.desk-label-fontsize-value');
    const fontWeightInput = editor.querySelector('.desk-label-fontweight');
    const letterSpacingInput = editor.querySelector('.desk-label-letterspacing');
    const letterSpacingValue = editor.querySelector('.desk-label-letterspacing-value');
    const fontFamilyInput = editor.querySelector('.desk-label-fontfamily');
    const preview = editor.querySelector('.desk-label-preview-text');
    const closeBtn = editor.querySelector('.desk-label-editor-close');
    const cancelBtn = editor.querySelector('.desk-label-cancel');
    const saveBtn = editor.querySelector('.desk-label-save');
    
    // Live preview updates
    const updatePreview = () => {
      preview.textContent = textInput.value;
      preview.style.fontSize = `${fontSizeInput.value}px`;
      preview.style.fontWeight = fontWeightInput.value;
      preview.style.letterSpacing = `${letterSpacingInput.value}em`;
      preview.style.fontFamily = fontFamilyInput.value || '';
      
      fontSizeValue.textContent = `${fontSizeInput.value}px`;
      letterSpacingValue.textContent = `${letterSpacingInput.value}em`;
    };
    
    textInput.addEventListener('input', updatePreview);
    fontSizeInput.addEventListener('input', updatePreview);
    fontWeightInput.addEventListener('change', updatePreview);
    letterSpacingInput.addEventListener('input', updatePreview);
    fontFamilyInput.addEventListener('change', updatePreview);
    
    // Close handlers
    const closeModal = () => modal.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    // Save handler
    saveBtn.addEventListener('click', () => {
      this.workspaceLabel = {
        text: textInput.value,
        fontSize: parseInt(fontSizeInput.value),
        fontWeight: parseInt(fontWeightInput.value),
        letterSpacing: parseFloat(letterSpacingInput.value),
        fontFamily: fontFamilyInput.value || undefined
      };
      
      this.workspaceLabelEl.textContent = this.workspaceLabel.text;
      this.applyWorkspaceLabelStyles();
      this.save();
      
      closeModal();
    });
    
    // Focus text input
    textInput.focus();
    textInput.select();
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
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
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
    saveDeskState(this.profileId, this.objects, this.workspaceLabel);
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
