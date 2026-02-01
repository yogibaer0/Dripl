/* =========================================================
   AMEBA Desk – Persistence & Storage
   ========================================================= */

const STORAGE_KEY = "ameba_desk_v2";
const SCHEMA_VERSION = 3;

/**
 * @typedef {Object} WorkspaceLabelSettings
 * @property {string} text - Label text
 * @property {number} fontSize - Font size in px
 * @property {number} fontWeight - Font weight (100-900)
 * @property {number} letterSpacing - Letter spacing in em
 * @property {string} [fontFamily] - Optional font family
 */

/**
 * @typedef {Object} DeskState
 * @property {number} version - Schema version
 * @property {string} profileId - Active profile ID
 * @property {Object[]} objects - Desk objects
 * @property {WorkspaceLabelSettings} [workspaceLabel] - Workspace label settings
 */

/**
 * Get default workspace label settings
 * @returns {WorkspaceLabelSettings}
 */
export function getDefaultWorkspaceLabel() {
  return {
    text: "Workspace",
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: 0.01,
    fontFamily: undefined
  };
}

/**
 * Load desk state from localStorage
 * @returns {DeskState|null}
 */
export function loadDeskState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    
    const state = JSON.parse(raw);
    
    // Handle version migration
    if (state.version === 2) {
      // Migrate from v2 to v3 (add workspace label)
      state.version = 3;
      state.workspaceLabel = getDefaultWorkspaceLabel();
    } else if (state.version !== SCHEMA_VERSION) {
      console.warn("[desk] Schema version mismatch, ignoring saved state");
      return null;
    }
    
    return state;
  } catch (err) {
    console.error("[desk] Failed to load state:", err);
    return null;
  }
}

/**
 * Save desk state to localStorage
 * @param {string} profileId - Active profile ID
 * @param {Object[]} objects - Desk objects
 * @param {WorkspaceLabelSettings} [workspaceLabel] - Workspace label settings
 * @returns {boolean} Success status
 */
export function saveDeskState(profileId, objects, workspaceLabel) {
  try {
    const state = {
      version: SCHEMA_VERSION,
      profileId,
      objects: objects.map(obj => ({
        id: obj.id,
        type: obj.type,
        label: obj.label,
        size: { ...obj.size },
        pos: { ...obj.pos },
        z: obj.z,
        payload: { ...obj.payload }
      })),
      workspaceLabel: workspaceLabel || getDefaultWorkspaceLabel()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error("[desk] Failed to save state:", err);
    return false;
  }
}

/**
 * Clear desk state
 */
export function clearDeskState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    console.error("[desk] Failed to clear state:", err);
    return false;
  }
}

/**
 * Get initial demo objects for a new desk
 * @returns {Object[]}
 */
export function getInitialObjects() {
  return [
    {
      id: `note-${Date.now()}-1`,
      type: "note",
      label: "Welcome to Desk",
      size: { w: 180, h: 140 },
      pos: { nx: 0.05, ny: 0.05 },
      z: 1,
      payload: {
        content: "Drag me around!\nObjects stay in the desk zone.",
        color: "#a78bfa"
      }
    },
    {
      id: `checklist-${Date.now()}-2`,
      type: "checklist",
      label: "Quick Tasks",
      size: { w: 160, h: 120 },
      pos: { nx: 0.55, ny: 0.15 },
      z: 2,
      payload: {
        items: [
          { id: 1, text: "Try dragging", done: false },
          { id: 2, text: "Click to open", done: false },
          { id: 3, text: "Switch profiles", done: false }
        ]
      }
    }
  ];
}
