/* =========================================================
   AMEBA Desk – Initialization
   ========================================================= */

import { Desk } from './desk.js';

/**
 * Initialize the AMEBA Desk
 * @returns {Desk|null}
 */
export function initDesk() {
  const deskStage = document.getElementById('deskStage');
  const newNoteBtn = document.getElementById('newNoteBtn');
  const newReminderBtn = document.getElementById('newReminderBtn');
  const profileSelect = document.getElementById('deskProfileSelect');
  
  if (!deskStage) {
    console.warn('[desk] Desk stage element not found');
    return null;
  }
  
  // Get initial profile from localStorage or default
  const savedState = localStorage.getItem('ameba_desk_v2');
  let initialProfile = 'workshop_L';
  
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      if (state.profileId) {
        initialProfile = state.profileId;
      }
    } catch (err) {
      console.warn('[desk] Failed to parse saved state for profile');
    }
  }
  
  // Create desk instance
  const desk = new Desk(deskStage, { profileId: initialProfile });
  
  // Set profile select value
  if (profileSelect) {
    profileSelect.value = initialProfile;
    
    // Handle profile switching
    profileSelect.addEventListener('change', (e) => {
      desk.switchProfile(e.target.value);
      console.log('[desk] Switched to profile:', e.target.value);
    });
  }
  
  // Handle new note button
  if (newNoteBtn) {
    newNoteBtn.addEventListener('click', () => {
      const noteContent = prompt('Note content:');
      if (noteContent) {
        desk.addObject('note', 'Quick Note', {
          content: noteContent,
          color: '#a78bfa'
        });
      }
    });
  }
  
  // Handle new reminder button
  if (newReminderBtn) {
    newReminderBtn.addEventListener('click', () => {
      const reminderText = prompt('Reminder:');
      if (reminderText) {
        desk.addObject('checklist', 'To-Do', {
          items: [
            { id: Date.now(), text: reminderText, done: false }
          ]
        });
      }
    });
  }
  
  // Listen for desk object open events
  window.addEventListener('ameba:desk-open', (e) => {
    console.log('[desk] Object opened:', e.detail);
    // TODO: Integrate with Q3 Projection panel
    // For now, just log it
    alert(`Opening ${e.detail.object.type}: ${e.detail.object.label}`);
  });
  
  console.log('[desk] Initialized with profile:', initialProfile);
  return desk;
}

// Make it available globally
window.initDesk = initDesk;
