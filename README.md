# Ameba

Ameba is a modular, living platform I’m building for creators.
It’s designed to feel organic — like something alive — where each part of the interface acts like a cell, working together to power creative tools.

At its core sits the **Destination Hub** — the main control center — surrounded by **satellites** that each represent different creative tools or connected platforms.
Every piece works together but remains visually and structurally independent. It’s not a template. It’s an evolving ecosystem.

## The Vision

Ameba isn’t just another site. It’s a creative environment.
The idea is that creators can work in a space that adapts to them, not the other way around.
The visuals are fluid — inspired by motion, liquid, and cell growth — and every module (or “satellite”) can evolve independently over time.

Right now, the focus is on getting the **Destination Hub** and its **satellites** to interact properly:
- The **hub** houses everything essential — like previews, controls, or upload logic.
- The **satellites** float *outside* of it, each acting as a quick access point for platforms like TikTok, YouTube, Reddit, and Instagram.
- They don’t orbit or move around — they simply exist in a space *around* the hub, slightly hovering and responsive to user interaction.

Everything about Ameba is designed to feel connected, but not restricted.

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
```

## Philosophy

Ameba isn’t about chasing trends — it’s about giving creators something real to build with.
It’s meant to feel natural, fluid, and adaptable. Every visual element has a reason.
The hub grows. The satellites breathe. Everything reacts.

This is my way of building something that doesn’t just function — it feels alive.

### Created by Mo Gray
Design, development, and direction by Ameba Labs.
