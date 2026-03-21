/* ==========================================================================
   AMEBA Campaign Store — localStorage-backed campaign state
   ========================================================================== */

(function CampaignStore() {
  "use strict";

  var STORAGE_KEY = "ameba_campaign";

  /* ---------- Default Seed Data ------------------------------------------ */
  var DEFAULT_CAMPAIGN = {
    name:          "Summer Drop 2025",
    client:        "Natura Vitae",
    goal:          "Launch seasonal product line with creator-led storytelling",
    type:          "Product Launch",
    duration:      "Jun 1 – Aug 31, 2025",
    platforms:     ["Instagram", "TikTok", "YouTube"],
    target:        "18–34, wellness-focused millennials",
    audience:      "Health-conscious consumers and lifestyle enthusiasts seeking clean beauty",
    location:      "US, CA, UK",
    campaignGoals: "Drive 40% awareness uplift and 15% conversion on new summer SKUs",
    messaging:     "Pure, natural, summer vitality — effortless wellness woven into your everyday routine",

    production: {
      deliverables: [
        {
          id: "d1", title: "Hero Reel — Launch Day", status: "In Review",
          platform: "Instagram", owner: "Yuki T.", version: "v2",
          bio:      "The flagship launch reel for Summer Drop 2025. Full-format vertical for Instagram feed + Reels. Hero product storytelling with lifestyle overlay and voice-over narration.",
          caption:  "Summer is here. Your glow, elevated. 🌿 #NaturaVitae #SummerDrop25",
          tasks: [
            { id: "t1", text: "Final color grade review",    done: true  },
            { id: "t2", text: "Sound mix approval",          done: true  },
            { id: "t3", text: "Client brand sign-off",       done: false },
            { id: "t4", text: "Export 4K archive + web cut", done: false }
          ],
          timeline: [
            { date: "Mar 10", event: "Brief received"              },
            { date: "Mar 13", event: "v1 delivered to client"      },
            { date: "Mar 16", event: "v2 delivered after feedback" },
            { date: "Mar 20", event: "Final delivery deadline"     }
          ],
          assetIds: ["a1", "a2"],
          feedback: "Color grade is excellent on v2. Just need final sign-off from client brand team before final export.",
          analytics: { views: "—", engagement: "—", status: "Pre-release" }
        },
        {
          id: "d2", title: "Summer Glow Tutorial", status: "In Production",
          platform: "YouTube", owner: "Sophie M.", version: "v1",
          bio:     "Long-form tutorial for YouTube. Step-by-step product usage with creator voice-over. Warm, educational tone with clear CTAs.",
          caption: "Your summer glow routine, simplified. Watch now 🌞 #NaturaVitae",
          tasks: [
            { id: "t1", text: "Script finalization",  done: true  },
            { id: "t2", text: "B-roll shot list",      done: true  },
            { id: "t3", text: "Primary shoot",         done: false },
            { id: "t4", text: "First edit assembly",   done: false }
          ],
          timeline: [
            { date: "Mar 12", event: "Script approved"    },
            { date: "Mar 19", event: "Shoot scheduled"    },
            { date: "Mar 26", event: "First cut delivery" },
            { date: "Apr 3",  event: "Final deadline"     }
          ],
          assetIds: ["a6", "a2"],
          feedback: "Script looks great. Ready to shoot next week.",
          analytics: { views: "—", engagement: "—", status: "Pre-production" }
        },
        {
          id: "d3", title: "Product Close-up Teaser", status: "Approved",
          platform: "TikTok", owner: "Carlos L.", version: "v3",
          bio:     "Short-form product close-up for TikTok. High visual impact, no dialogue. Clean beauty shots with kinetic editing and trending audio.",
          caption: "Clean beauty that moves 💫 #SummerDrop #NaturaVitae #CleanBeauty",
          tasks: [
            { id: "t1", text: "Visual brief approved",      done: true },
            { id: "t2", text: "Product shots captured",     done: true },
            { id: "t3", text: "Edit v1 + v2 + v3 complete", done: true },
            { id: "t4", text: "Client sign-off received",   done: true }
          ],
          timeline: [
            { date: "Mar 5",  event: "Shot list approved" },
            { date: "Mar 8",  event: "Shoot completed"    },
            { date: "Mar 12", event: "v1 delivered"       },
            { date: "Mar 15", event: "Approved by client" }
          ],
          assetIds: ["a3", "a4"],
          feedback: "Perfect. Approved. Ready for delivery pipeline.",
          analytics: { views: "—", engagement: "—", status: "Ready for export" }
        },
        {
          id: "d4", title: "Creator Testimonial Cut", status: "Draft",
          platform: "Instagram", owner: "Amara K.", version: "v1",
          bio:     "Creator testimonial cut featuring Amara K. giving her personal story about the product. Authentic, unscripted feel with light editing.",
          caption: "This changed my morning routine 🌿 @NaturaVitae #GlowFromWithin",
          tasks: [
            { id: "t1", text: "Creator brief sent",   done: true  },
            { id: "t2", text: "Filming scheduled",    done: false },
            { id: "t3", text: "Raw footage received", done: false },
            { id: "t4", text: "First edit",           done: false }
          ],
          timeline: [
            { date: "Mar 14", event: "Creator briefed"    },
            { date: "Mar 22", event: "Filming date"        },
            { date: "Mar 28", event: "First cut delivery"  },
            { date: "Apr 4",  event: "Final deadline"      }
          ],
          assetIds: ["a2", "a5"],
          feedback: "Waiting on creator to confirm filming date.",
          analytics: { views: "—", engagement: "—", status: "Pre-production" }
        },
        {
          id: "d5", title: "BTS Story Set", status: "In Review",
          platform: "Instagram", owner: "Yuki T.", version: "v1",
          bio:     "Instagram Story set documenting behind-the-scenes of the Summer Drop shoot. Casual, authentic day-in-the-life format. 6–8 story slides.",
          caption: "Behind the scenes of our favourite shoot yet 📸 #NaturaVitae",
          tasks: [
            { id: "t1", text: "Story structure outline",   done: true  },
            { id: "t2", text: "BTS footage compiled",      done: true  },
            { id: "t3", text: "Story design + overlays",   done: false },
            { id: "t4", text: "Client review",             done: false }
          ],
          timeline: [
            { date: "Mar 11", event: "Footage collected" },
            { date: "Mar 17", event: "v1 assembled"      },
            { date: "Mar 21", event: "Client review"     },
            { date: "Mar 24", event: "Final delivery"    }
          ],
          assetIds: ["a1", "a4"],
          feedback: "BTS footage is great. Need to add Natura Vitae story overlays and branded frames.",
          analytics: { views: "—", engagement: "—", status: "In review" }
        }
      ]
    },

    assets: {
      files: [
        { id: "a1", name: "hero-shot-final.mp4",    type: "Raw",       size: "2.3 GB", date: "Mar 15", linked: true  },
        { id: "a2", name: "brand-kit-2025.zip",     type: "Brand",     size: "145 MB", date: "Mar 10", linked: true  },
        { id: "a3", name: "product-close-edit.mp4", type: "Edit",      size: "890 MB", date: "Mar 17", linked: true  },
        { id: "a4", name: "thumbnail-set-v2.psd",   type: "Thumbnail", size: "78 MB",  date: "Mar 18", linked: true  },
        { id: "a5", name: "campaign-brief.pdf",     type: "Document",  size: "4.2 MB", date: "Mar 8",  linked: true  },
        { id: "a6", name: "raw-footage-day1.mov",   type: "Raw",       size: "8.1 GB", date: "Mar 12", linked: true  }
      ]
    },

    delivery: {
      items: [
        { id: "e1", title: "Product Close-up Teaser", status: "Ready",     platform: "TikTok",    owner: "Carlos L.", notes: "Approved by client Mar 15"     },
        { id: "e2", title: "Hero Reel — Launch Day",  status: "In Review", platform: "Instagram", owner: "Yuki T.",   notes: "Final client approval pending" },
        { id: "e3", title: "Creator Testimonial Cut", status: "Draft",     platform: "Instagram", owner: "Amara K.",  notes: "Awaiting final footage"        }
      ],
      readiness:   72,
      exportNotes: "Hero Reel pending final color grade. TikTok cut ready for export."
    }
  };

  /* ---------- Migration -------------------------------------------------- */
  /**
   * Migrate legacy campaign data (assets: [string]) to the normalised model
   * (assetIds: [id]). Also refreshes the `linked` flag on every asset file
   * to match the actual assetIds references across all deliverables.
   * Safe to call on already-migrated data (idempotent).
   */
  function _migrate(campaign) {
    if (!campaign) return campaign;

    var files = (campaign.assets && campaign.assets.files) ? campaign.assets.files : [];

    // Build a name → id lookup for legacy migration
    var nameToId = {};
    files.forEach(function (f) { nameToId[f.name] = f.id; });

    // Convert deliverables that still use string asset arrays
    if (campaign.production && campaign.production.deliverables) {
      campaign.production.deliverables = campaign.production.deliverables.map(function (d) {
        if (d.assets && !d.assetIds) {
          d.assetIds = d.assets
            .map(function (name) { return nameToId[name]; })
            .filter(Boolean);
          delete d.assets;
        } else if (!d.assetIds) {
          d.assetIds = [];
        }
        return d;
      });

      // Re-compute `linked` flag on every asset file
      var linkedIds = {};
      campaign.production.deliverables.forEach(function (d) {
        (d.assetIds || []).forEach(function (id) { linkedIds[id] = true; });
      });
      files.forEach(function (f) { f.linked = !!linkedIds[f.id]; });
    }

    return campaign;
  }

  /* ---------- Store API --------------------------------------------------- */
  var store = {

    /**
     * Seed localStorage with defaultData (or built-in defaults) if empty.
     * Applies migration for legacy data on subsequent loads.
     */
    init: function (defaultData) {
      try {
        var existing = localStorage.getItem(STORAGE_KEY);
        if (!existing) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData || DEFAULT_CAMPAIGN));
        } else {
          // Migrate legacy string-based asset references if present
          var parsed   = JSON.parse(existing);
          var migrated = _migrate(parsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        }
      } catch (e) {
        console.warn("[ameba] Campaign store: localStorage unavailable, running in-memory only.", e);
      }
    },

    /** Return the full campaign object from storage, or null if not initialised. */
    getCampaign: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.warn("[ameba] Campaign store: failed to read campaign data.", e);
        return null;
      }
    },

    /** Replace the entire campaign object in storage. */
    setCampaign: function (data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn("[ameba] Campaign store: failed to persist campaign data.", e);
      }
    },

    /**
     * Apply an updater function to the stored campaign and persist the result.
     * updaterFn receives the current campaign object and must return the updated one.
     */
    updateCampaign: function (updaterFn) {
      var current = this.getCampaign();
      var updated = updaterFn(current);
      this.setCampaign(updated);
      return updated;
    },

    /** Return all deliverables. */
    getDeliverables: function () {
      var campaign = this.getCampaign();
      return campaign ? campaign.production.deliverables : [];
    },

    /** Return one deliverable by id, or null. */
    getDeliverable: function (id) {
      var deliverables = this.getDeliverables();
      for (var i = 0; i < deliverables.length; i++) {
        if (deliverables[i].id === id) return deliverables[i];
      }
      return null;
    },

    /**
     * Apply an updater function to one deliverable and persist.
     * updaterFn receives the deliverable object and must return the updated one.
     */
    updateDeliverable: function (id, updaterFn) {
      this.updateCampaign(function (campaign) {
        campaign.production.deliverables = campaign.production.deliverables.map(function (d) {
          return d.id === id ? updaterFn(d) : d;
        });
        return campaign;
      });
    },

    /** Return all campaign asset files. */
    getAssets: function () {
      var campaign = this.getCampaign();
      return campaign ? campaign.assets.files : [];
    },

    /** Return a single asset object by its stable id, or null. */
    getAssetById: function (id) {
      var files = this.getAssets();
      for (var i = 0; i < files.length; i++) {
        if (files[i].id === id) return files[i];
      }
      return null;
    },

    /**
     * Return the full asset objects linked to a given deliverable id.
     * Returns an empty array if the deliverable or assets are not found.
     */
    getAssetsForDeliverable: function (deliverableId) {
      var self       = this;
      var deliverable = this.getDeliverable(deliverableId);
      if (!deliverable) return [];
      return (deliverable.assetIds || [])
        .map(function (id) { return self.getAssetById(id); })
        .filter(Boolean);
    },

    /**
     * Link an asset to a deliverable by storing the assetId in
     * deliverable.assetIds and setting asset.linked = true.
     * Idempotent — will not add duplicates.
     */
    linkAssetToDeliverable: function (assetId, deliverableId) {
      this.updateCampaign(function (campaign) {
        // Update deliverable assetIds
        campaign.production.deliverables = campaign.production.deliverables.map(function (d) {
          if (d.id === deliverableId) {
            var ids = d.assetIds || [];
            if (ids.indexOf(assetId) === -1) {
              d.assetIds = ids.concat([assetId]);
            }
          }
          return d;
        });

        // Mark asset as linked
        campaign.assets.files = campaign.assets.files.map(function (f) {
          if (f.id === assetId) f.linked = true;
          return f;
        });

        return campaign;
      });
    },

    /**
     * Unlink an asset from a specific deliverable.
     * Clears asset.linked only when the asset is not referenced by any other deliverable.
     */
    unlinkAssetFromDeliverable: function (assetId, deliverableId) {
      this.updateCampaign(function (campaign) {
        // Remove assetId from the target deliverable
        campaign.production.deliverables = campaign.production.deliverables.map(function (d) {
          if (d.id === deliverableId) {
            d.assetIds = (d.assetIds || []).filter(function (id) { return id !== assetId; });
          }
          return d;
        });

        // Determine whether the asset is still referenced by any deliverable
        var stillLinked = campaign.production.deliverables.some(function (d) {
          return (d.assetIds || []).indexOf(assetId) !== -1;
        });

        // Update the linked flag on the asset
        campaign.assets.files = campaign.assets.files.map(function (f) {
          if (f.id === assetId) f.linked = stillLinked;
          return f;
        });

        return campaign;
      });
    },

    /**
     * Return asset files that are not currently linked to any deliverable.
     * Derived from deliverable.assetIds — the authoritative source of truth.
     */
    getUnlinkedAssets: function () {
      var campaign = this.getCampaign();
      if (!campaign) return [];
      var linkedIds = {};
      campaign.production.deliverables.forEach(function (d) {
        (d.assetIds || []).forEach(function (id) { linkedIds[id] = true; });
      });
      return campaign.assets.files.filter(function (f) { return !linkedIds[f.id]; });
    },

    /**
     * Return assets that are referenced by at least one deliverable.
     * Each entry: { id, name, type, size, date, campaign, deliverables[] }.
     */
    getLinkedAssets: function () {
      var campaign = this.getCampaign();
      if (!campaign) return [];

      // Build a map: assetId → array of deliverable titles that reference it
      var assetToDeliverables = {};
      campaign.production.deliverables.forEach(function (d) {
        (d.assetIds || []).forEach(function (aid) {
          if (!assetToDeliverables[aid]) assetToDeliverables[aid] = [];
          assetToDeliverables[aid].push(d.title);
        });
      });

      var campaignName = campaign.name;
      return campaign.assets.files
        .filter(function (f) { return assetToDeliverables[f.id]; })
        .map(function (f) {
          var delivTitles = assetToDeliverables[f.id];
          return {
            id:          f.id,
            name:        f.name,
            type:        f.type,
            size:        f.size,
            date:        f.date,
            campaign:    campaignName,
            deliverable: delivTitles[0],            // primary deliverable (first)
            deliverables: delivTitles               // all deliverables
          };
        });
    }
  };

  /* ---------- Expose on window.AMEBA.storage.campaign -------------------- */
  window.AMEBA = window.AMEBA || {};
  window.AMEBA.storage = window.AMEBA.storage || {};
  window.AMEBA.storage.campaign = store;

  console.log("[ameba] Campaign store ready");

}());
