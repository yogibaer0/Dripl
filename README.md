# Ameba 🌿

Ameba is a modular, living platform I’m building for creators.  
It’s designed to feel organic — like something alive — where each part of the interface acts like a cell, working together to power creative tools.

At its core sits the **Destination Hub** — the main control center — surrounded by **satellites** that each represent different creative tools or connected platforms. Every piece works together but remains visually and structurally independent. It’s not a template. It’s an evolving ecosystem.

---

## Dripl Engine (inside Ameba)
The first flagship service inside Ameba is **Dripl Engine**, a media conversion and management tool for link-based MP3/MP4 conversions and other creator utilities.

---

## 🔧 Current Features

- **Modular Hub System**: Cell-like UI with satellites beside (not inside) the hub  
- **Dripl Engine**: Convert YouTube, TikTok, Reddit, MP4  
- **Platform Presets**: Optimized output for TikTok, Instagram, YouTube, Reddit  
- **Queue + Worker System** (design/roadmap): Prevents overload for smooth conversions  
- **Glow/UX**: Dark theme with platform-specific glows  
- **Mobile-Friendly( WIP )**: Responsive design that reflows cleanly below 1100px  
- **Render Deployment**: Production build pipeline with health checks

---

## 🛰️ Satellite Placement (Destination Hub)

**Goal:** Satellites live in fixed vertical slots **outside** the hub’s right edge, never overlapping hub content.  
They are hoverable, clickable, and can “dock” temporarily near the hub action row, then return to their slot.

**Rules:**
- Slots are computed relative to the destination hub (**`.panel--dest`**), not the storage panel.  
- Hub content is constrained by an inner wrapper (**`.dest-inner`**) so metadata rows and the convert button never spill into the satellite lane.  
- A right-side gutter (e.g., `--orbit-reserve: 166px`) is always reserved for satellites.  
- Below **1100px**, satellites reflow to a row **beneath** the hub (still grouped; no overlap).

---

## 🗂️ Project Structure (high-level)


## Structure

| Part | Description |
|------|--------------|
| **Destination Hub** | The main workspace and brain of Ameba. It resizes and morphs as needed, but never overlaps with satellites. |
| **Satellites** | Independent, clickable buttons that represent connected tools or platforms. They float around the hub without ever sitting inside it. |
| **Panels** | Supporting UI modules (Upload, Import, Storage) that link to the hub’s functions. These remain stable and aligned at the top of the interface. |
| **Dripl Engine** | The first core “satellite” inside Ameba — a link-based MP3/MP4 converter that powers creative media management. |

## What I’m Building

Right now, I’m finalizing the relationship between the **hub** and the **satellites** — making sure the hub leaves real physical space for satellites to exist and never stretches behind them.

Each satellite will have a designated position (slot) outside the hub, and later on they’ll animate or fade in as Ameba grows and morphs.
The goal is stability first, motion second.

## Tech Overview

- **Frontend:** HTML + CSS + Vanilla JS
- **Backend:** Node.js / Express
- **Deployment:** Render
- **Planned Integrations:** Redis (for caching), Supabase (for storage), ffmpeg + yt-dlp (for Dripl Engine)

Current files:
```
/public/index.template.html  → base HTML structure
/public/styles.css           → core styles (hub, panel, satellites)
/public/script.js            → logic for hub + satellite behavior
/public/layout-kernel.js     → layout system (zones + panels)
/public/layout-tuner.js      → dev-only layout editor
```

---

## 🎨 Layout Tuner (Developer Tool)

The Layout Tuner is a developer-only overlay for adjusting zone spacing and positioning without manually editing code.

### Features
- **Toggle with Ctrl+Shift+L** or click the floating "L" button
- **Visual zone outlines** with labels (topNav, leftRail, centerStage, etc.)
- **Draggable zone edges** for live resizing
- **Copy JSON** to export updated layouts in the exact format used by profiles
- **Save to localStorage** for persistent dev tuning
- **Reset to defaults** to restore original layout
- **Page type switching** between workshop and platform layouts

### How to Use
1. Start the dev server: `npm run dev`
2. Press **Ctrl+Shift+L** or click the purple "L" button to open the tuner
3. Drag zone edges to resize (infrastructure ready)
4. Switch between workshop/platform page types
5. Click "Copy JSON" to export your changes
6. Click "Save to localStorage" to persist changes during development
7. Press **Ctrl+Shift+L** again to close the tuner

### Dev-Only Mode
The Layout Tuner automatically disables in production. It only runs when:
- Hostname is `localhost` or `127.0.0.1`
- Running on a non-standard port
- `AMEBA_DEV_MODE=true` is set in localStorage

---

## Philosophy

Ameba isn’t about chasing trends — it’s about giving creators something real to build with.
It’s meant to feel natural, fluid, and adaptable. Every visual element has a reason.
The hub grows. The satellites breathe. Everything reacts.

This is my way of building something that doesn’t just function — it feels alive.

### Created by Mo Gray
Design, development, and direction by Ameba Labs.
