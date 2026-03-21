/* ==========================================================================
   AMEBA Campaign Store — multi-campaign localStorage-backed state
   ========================================================================== */

(function CampaignStore() {
  "use strict";

  var STORAGE_KEY = "ameba_campaign_v2";

  /* ---------- Seed Data --------------------------------------------------- */
  var SUMMER_DROP = {
    id:            "c1",
    name:          "Summer Drop 2025",
    client:        "Natura Vitae",
    goal:          "Launch seasonal product line with creator-led storytelling",
    type:          "Product Launch",
    duration:      "Jun 1 \u2013 Aug 31, 2025",
    platforms:     ["Instagram", "TikTok", "YouTube"],
    target:        "18\u201334, wellness-focused millennials",
    audience:      "Health-conscious consumers and lifestyle enthusiasts seeking clean beauty",
    location:      "US, CA, UK",
    campaignGoals: "Drive 40% awareness uplift and 15% conversion on new summer SKUs",
    messaging:     "Pure, natural, summer vitality \u2014 effortless wellness woven into your everyday routine",

    production: {
      deliverables: [
        {
          id: "d1", title: "Hero Reel \u2014 Launch Day", status: "In Review",
          platform: "Instagram", owner: "Yuki T.", version: "v2",
          bio:      "The flagship launch reel for Summer Drop 2025. Full-format vertical for Instagram feed + Reels. Hero product storytelling with lifestyle overlay and voice-over narration.",
          caption:  "Summer is here. Your glow, elevated. \ud83c\udf3f #NaturaVitae #SummerDrop25",
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
          analytics: { views: "\u2014", engagement: "\u2014", status: "Pre-release" }
        },
        {
          id: "d2", title: "Summer Glow Tutorial", status: "In Production",
          platform: "YouTube", owner: "Sophie M.", version: "v1",
          bio:     "Long-form tutorial for YouTube. Step-by-step product usage with creator voice-over. Warm, educational tone with clear CTAs.",
          caption: "Your summer glow routine, simplified. Watch now \ud83c\udf1e #NaturaVitae",
          tasks: [
            { id: "t1", text: "Script finalization", done: true  },
            { id: "t2", text: "B-roll shot list",    done: true  },
            { id: "t3", text: "Primary shoot",       done: false },
            { id: "t4", text: "First edit assembly", done: false }
          ],
          timeline: [
            { date: "Mar 12", event: "Script approved"    },
            { date: "Mar 19", event: "Shoot scheduled"    },
            { date: "Mar 26", event: "First cut delivery" },
            { date: "Apr 3",  event: "Final deadline"     }
          ],
          assetIds: ["a6", "a2"],
          feedback: "Script looks great. Ready to shoot next week.",
          analytics: { views: "\u2014", engagement: "\u2014", status: "Pre-production" }
        },
        {
          id: "d3", title: "Product Close-up Teaser", status: "Approved",
          platform: "TikTok", owner: "Carlos L.", version: "v3",
          bio:     "Short-form product close-up for TikTok. High visual impact, no dialogue. Clean beauty shots with kinetic editing and trending audio.",
          caption: "Clean beauty that moves \ud83d\udcab #SummerDrop #NaturaVitae #CleanBeauty",
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
          analytics: { views: "\u2014", engagement: "\u2014", status: "Ready for export" }
        },
        {
          id: "d4", title: "Creator Testimonial Cut", status: "Draft",
          platform: "Instagram", owner: "Amara K.", version: "v1",
          bio:     "Creator testimonial cut featuring Amara K. giving her personal story about the product. Authentic, unscripted feel with light editing.",
          caption: "This changed my morning routine \ud83c\udf3f @NaturaVitae #GlowFromWithin",
          tasks: [
            { id: "t1", text: "Creator brief sent",   done: true  },
            { id: "t2", text: "Filming scheduled",    done: false },
            { id: "t3", text: "Raw footage received", done: false },
            { id: "t4", text: "First edit",           done: false }
          ],
          timeline: [
            { date: "Mar 14", event: "Creator briefed"   },
            { date: "Mar 22", event: "Filming date"       },
            { date: "Mar 28", event: "First cut delivery" },
            { date: "Apr 4",  event: "Final deadline"     }
          ],
          assetIds: ["a2", "a5"],
          feedback: "Waiting on creator to confirm filming date.",
          analytics: { views: "\u2014", engagement: "\u2014", status: "Pre-production" }
        },
        {
          id: "d5", title: "BTS Story Set", status: "In Review",
          platform: "Instagram", owner: "Yuki T.", version: "v1",
          bio:     "Instagram Story set documenting behind-the-scenes of the Summer Drop shoot. Casual, authentic day-in-the-life format. 6\u20138 story slides.",
          caption: "Behind the scenes of our favourite shoot yet \ud83d\udcf8 #NaturaVitae",
          tasks: [
            { id: "t1", text: "Story structure outline", done: true  },
            { id: "t2", text: "BTS footage compiled",    done: true  },
            { id: "t3", text: "Story design + overlays", done: false },
            { id: "t4", text: "Client review",           done: false }
          ],
          timeline: [
            { date: "Mar 11", event: "Footage collected" },
            { date: "Mar 17", event: "v1 assembled"      },
            { date: "Mar 21", event: "Client review"     },
            { date: "Mar 24", event: "Final delivery"    }
          ],
          assetIds: ["a1", "a4"],
          feedback: "BTS footage is great. Need to add Natura Vitae story overlays and branded frames.",
          analytics: { views: "\u2014", engagement: "\u2014", status: "In review" }
        }
      ]
    },

    assets: {
      files: [
        { id: "a1", name: "hero-shot-final.mp4",    type: "Raw",       size: "2.3 GB", date: "Mar 15" },
        { id: "a2", name: "brand-kit-2025.zip",     type: "Brand",     size: "145 MB", date: "Mar 10" },
        { id: "a3", name: "product-close-edit.mp4", type: "Edit",      size: "890 MB", date: "Mar 17" },
        { id: "a4", name: "thumbnail-set-v2.psd",   type: "Thumbnail", size: "78 MB",  date: "Mar 18" },
        { id: "a5", name: "campaign-brief.pdf",     type: "Document",  size: "4.2 MB", date: "Mar 8"  },
        { id: "a6", name: "raw-footage-day1.mov",   type: "Raw",       size: "8.1 GB", date: "Mar 12" }
      ]
    },

    delivery: {
      items: [
        { id: "e1", title: "Product Close-up Teaser", status: "Ready",     platform: "TikTok",    owner: "Carlos L.", notes: "Approved by client Mar 15"     },
        { id: "e2", title: "Hero Reel \u2014 Launch Day",  status: "In Review", platform: "Instagram", owner: "Yuki T.",   notes: "Final client approval pending" },
        { id: "e3", title: "Creator Testimonial Cut", status: "Draft",     platform: "Instagram", owner: "Amara K.",  notes: "Awaiting final footage"        }
      ],
      readiness:   72,
      exportNotes: "Hero Reel pending final color grade. TikTok cut ready for export."
    }
  };

  var BRAND_RESET = {
    id:            "c2",
    name:          "Brand Reset Q3",
    client:        "Lumen Studios",
    goal:          "Reposition brand identity across digital channels ahead of Q3 refresh",
    type:          "Brand Campaign",
    duration:      "Jul 1 \u2013 Sep 30, 2025",
    platforms:     ["Instagram", "LinkedIn", "YouTube"],
    target:        "25\u201344, design-forward professionals",
    audience:      "Creative industry decision-makers and brand-aware consumers",
    location:      "US, EU",
    campaignGoals: "Lift brand recall by 30% and grow LinkedIn follower base by 20%",
    messaging:     "Bold clarity. Purposeful design. A brand with something to say.",

    production: {
      deliverables: [
        {
          id: "d1", title: "Brand Manifesto Film", status: "In Production",
          platform: "YouTube", owner: "Sophie M.", version: "v1",
          bio:     "90-second brand film articulating the new Lumen Studios identity. Cinematic, minimal dialogue, strong visual language.",
          caption: "We build things that last. \u2014 Lumen Studios",
          tasks: [
            { id: "t1", text: "Script approved",        done: true  },
            { id: "t2", text: "Director brief complete", done: true  },
            { id: "t3", text: "Principal photography",   done: false },
            { id: "t4", text: "Post-production edit",    done: false }
          ],
          timeline: [
            { date: "Jul 5",  event: "Brief approved"    },
            { date: "Jul 18", event: "Shoot week"         },
            { date: "Aug 1",  event: "First cut delivery" },
            { date: "Aug 15", event: "Final deadline"     }
          ],
          assetIds: ["b1", "b2"],
          feedback: "Director brief is solid. Ready to lock locations.",
          analytics: { views: "\u2014", engagement: "\u2014", status: "Pre-production" }
        },
        {
          id: "d2", title: "Identity Reveal Social Set", status: "Draft",
          platform: "Instagram", owner: "Carlos L.", version: "v1",
          bio:     "Series of 6 static posts revealing the new brand identity. Teaser sequence with full reveal on launch day.",
          caption: "Something new is coming. \u2014 #LumenStudios",
          tasks: [
            { id: "t1", text: "Concept approved",  done: true  },
            { id: "t2", text: "Design mockups",    done: false },
            { id: "t3", text: "Copy review",       done: false },
            { id: "t4", text: "Final asset export", done: false }
          ],
          timeline: [
            { date: "Jul 10", event: "Concept sign-off"  },
            { date: "Jul 25", event: "Design delivery"   },
            { date: "Aug 5",  event: "Copy approved"     },
            { date: "Aug 10", event: "Final deadline"    }
          ],
          assetIds: ["b2"],
          feedback: "Concept looks strong. Move to design phase.",
          analytics: { views: "\u2014", engagement: "\u2014", status: "Pre-production" }
        },
        {
          id: "d3", title: "LinkedIn Thought Leadership Series", status: "In Review",
          platform: "LinkedIn", owner: "Yuki T.", version: "v2",
          bio:     "4-part article series positioning Lumen Studios leadership as industry thought leaders during the brand reset.",
          caption: "Design leadership in 2025: what we\u2019ve learned \u2014 Lumen Studios",
          tasks: [
            { id: "t1", text: "Outline approved",    done: true },
            { id: "t2", text: "Articles written",    done: true },
            { id: "t3", text: "Editorial review",    done: true },
            { id: "t4", text: "Client final sign-off", done: false }
          ],
          timeline: [
            { date: "Jul 8",  event: "Outline agreed"     },
            { date: "Jul 20", event: "Articles delivered" },
            { date: "Jul 28", event: "Editorial pass"     },
            { date: "Aug 3",  event: "Final deadline"     }
          ],
          assetIds: ["b3"],
          feedback: "Articles are well written. Awaiting final client approval.",
          analytics: { views: "\u2014", engagement: "\u2014", status: "In review" }
        }
      ]
    },

    assets: {
      files: [
        { id: "b1", name: "lumen-brand-identity-2025.ai", type: "Brand",    size: "220 MB", date: "Jul 5"  },
        { id: "b2", name: "manifesto-storyboard-v1.pdf",  type: "Document", size: "8.4 MB", date: "Jul 6"  },
        { id: "b3", name: "thought-leadership-copy.docx", type: "Document", size: "1.2 MB", date: "Jul 12" }
      ]
    },

    delivery: {
      items: [
        { id: "e1", title: "LinkedIn Thought Leadership Series", status: "In Review", platform: "LinkedIn",  owner: "Yuki T.",   notes: "Awaiting final sign-off" },
        { id: "e2", title: "Brand Manifesto Film",               status: "Draft",     platform: "YouTube",   owner: "Sophie M.", notes: "In production"           },
        { id: "e3", title: "Identity Reveal Social Set",         status: "Draft",     platform: "Instagram", owner: "Carlos L.", notes: "Design phase"            }
      ],
      readiness:   28,
      exportNotes: "LinkedIn series nearly ready. Film and social set still in production."
    }
  };

  var INFLUENCER_COLLAB = {
    id:            "c3",
    name:          "Influencer Collab #4",
    client:        "Bloom Athletics",
    goal:          "Drive product trial through creator-led content with authentic lifestyle integration",
    type:          "Influencer Campaign",
    duration:      "Aug 15 \u2013 Oct 15, 2025",
    platforms:     ["TikTok", "Instagram", "YouTube Shorts"],
    target:        "16\u201328, active lifestyle Gen Z",
    audience:      "Fitness enthusiasts and active lifestyle consumers who follow creator content",
    location:      "US, AU, UK",
    campaignGoals: "100K UGC impressions and 8% click-through on product links",
    messaging:     "Move with it. Live with it. The gear that keeps up with you.",

    production: {
      deliverables: [
        {
          id: "d1", title: "Hero Creator Haul TikTok", status: "Approved",
          platform: "TikTok", owner: "Amara K.", version: "v2",
          bio:     "Amara K. unboxing and first-wear review of the Bloom Athletics AW25 collection. Authentic, high-energy TikTok format.",
          caption: "New drop just landed and I am OBSESSED \ud83d\udd25 @BloomAthletics #BloomCollab",
          tasks: [
            { id: "t1", text: "Creator brief sent",      done: true },
            { id: "t2", text: "Content filmed",          done: true },
            { id: "t3", text: "Brand review complete",   done: true },
            { id: "t4", text: "Creator approval given",  done: true }
          ],
          timeline: [
            { date: "Aug 18", event: "Brief accepted"     },
            { date: "Aug 22", event: "Content delivered"  },
            { date: "Aug 26", event: "Brand approved"     },
            { date: "Aug 28", event: "Ready for posting"  }
          ],
          assetIds: ["c1", "c2"],
          feedback: "Exactly the energy we wanted. Approved without changes.",
          analytics: { views: "\u2014", engagement: "\u2014", status: "Ready for export" }
        },
        {
          id: "d2", title: "60s YouTube Shorts Review", status: "In Production",
          platform: "YouTube Shorts", owner: "Sophie M.", version: "v1",
          bio:     "60-second YouTube Short with creator commentary on performance and fit. Clean, direct-to-camera format.",
          caption: "Honest review after 2 weeks: here\u2019s what I think \ud83d\udca1 #BloomAthletics",
          tasks: [
            { id: "t1", text: "Script outline",       done: true  },
            { id: "t2", text: "Filming scheduled",    done: true  },
            { id: "t3", text: "First cut delivered",  done: false },
            { id: "t4", text: "Brand review",         done: false }
          ],
          timeline: [
            { date: "Aug 20", event: "Script agreed"       },
            { date: "Aug 24", event: "Filming"              },
            { date: "Sep 2",  event: "First cut delivery"   },
            { date: "Sep 10", event: "Final deadline"       }
          ],
          assetIds: ["c2"],
          feedback: "Filming confirmed. First cut expected by Sep 2.",
          analytics: { views: "\u2014", engagement: "\u2014", status: "In production" }
        },
        {
          id: "d3", title: "Instagram Story Takeover", status: "Draft",
          platform: "Instagram", owner: "Carlos L.", version: "v1",
          bio:     "Full-day Instagram Story takeover by Amara K. featuring product integration across workout, travel, and daily life.",
          caption: "Spending the day with @BloomAthletics \u2014 come along \ud83d\udc4b",
          tasks: [
            { id: "t1", text: "Takeover brief sent",   done: true  },
            { id: "t2", text: "Shot list agreed",      done: false },
            { id: "t3", text: "Content day",           done: false },
            { id: "t4", text: "Brand story review",    done: false }
          ],
          timeline: [
            { date: "Sep 5",  event: "Brief sent"          },
            { date: "Sep 12", event: "Shot list sign-off"  },
            { date: "Sep 18", event: "Content day"         },
            { date: "Sep 22", event: "Final deadline"      }
          ],
          assetIds: [],
          feedback: "Brief accepted. Shot list in progress.",
          analytics: { views: "\u2014", engagement: "\u2014", status: "Pre-production" }
        }
      ]
    },

    assets: {
      files: [
        { id: "c1", name: "bloom-haul-raw-footage.mp4", type: "Raw",  size: "3.7 GB", date: "Aug 22" },
        { id: "c2", name: "bloom-brand-guidelines.pdf", type: "Brand", size: "5.1 MB", date: "Aug 15" }
      ]
    },

    delivery: {
      items: [
        { id: "e1", title: "Hero Creator Haul TikTok",   status: "Ready",     platform: "TikTok",          owner: "Amara K.",  notes: "Approved. Ready to post"   },
        { id: "e2", title: "60s YouTube Shorts Review",  status: "Draft",     platform: "YouTube Shorts", owner: "Sophie M.", notes: "In production"             },
        { id: "e3", title: "Instagram Story Takeover",   status: "Draft",     platform: "Instagram",      owner: "Carlos L.", notes: "Brief stage"               }
      ],
      readiness:   40,
      exportNotes: "TikTok haul ready to post. YouTube Short and Story Takeover still in progress."
    }
  };

  var DEFAULT_STATE = {
    activeCampaignId: "c1",
    campaigns: [SUMMER_DROP, BRAND_RESET, INFLUENCER_COLLAB]
  };

  /* ---------- Migration --------------------------------------------------- */
  /**
   * Migrate legacy single-campaign shape into multi-campaign state.
   * Detects: raw campaign object (has .production, .assets, .delivery but no .campaigns).
   * Also migrates legacy string-based asset arrays within each campaign.
   * Safe to call on already-migrated data (idempotent).
   */
  function _migrateCampaign(campaign) {
    if (!campaign) return campaign;
    var files = (campaign.assets && campaign.assets.files) ? campaign.assets.files : [];
    var nameToId = {};
    files.forEach(function (f) { nameToId[f.name] = f.id; });

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
    }

    // Remove stale .linked flags — they are derived at read time
    files.forEach(function (f) { delete f.linked; });

    return campaign;
  }

  function _migrateState(parsed) {
    if (!parsed) return null;

    // Already multi-campaign shape
    if (parsed.campaigns && Array.isArray(parsed.campaigns)) {
      parsed.campaigns = parsed.campaigns.map(_migrateCampaign);
      return parsed;
    }

    // Legacy single-campaign object
    var legacy = _migrateCampaign(parsed);
    if (!legacy.id) legacy.id = "c1";
    return {
      activeCampaignId: legacy.id,
      campaigns: [legacy]
    };
  }

  /* ---------- In-memory fallback ----------------------------------------- */
  var _memState = null;

  /* ---------- Low-level read / write ------------------------------------- */
  function _read() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("[ameba] Campaign store: read failed.", e);
      return _memState;
    }
  }

  function _write(state) {
    _memState = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("[ameba] Campaign store: write failed.", e);
    }
  }

  /* ---------- Store API --------------------------------------------------- */
  var store = {

    /**
     * Initialise the store.
     * - Migrates any legacy single-campaign localStorage data.
     * - Seeds with DEFAULT_STATE (or supplied defaultData) if nothing exists.
     */
    init: function (defaultData) {
      var existing = _read();
      if (!existing) {
        _write(defaultData || DEFAULT_STATE);
      } else {
        _write(_migrateState(existing));
      }
    },

    /** Return the full multi-campaign state object. */
    getState: function () {
      return _read() || DEFAULT_STATE;
    },

    /** Replace the entire state object. */
    setState: function (data) {
      _write(data);
    },

    /** Return all campaigns. */
    getCampaigns: function () {
      return this.getState().campaigns || [];
    },

    /** Return the active campaign id. */
    getActiveCampaignId: function () {
      return this.getState().activeCampaignId || null;
    },

    /** Set the active campaign by id and persist. */
    setActiveCampaign: function (id) {
      var s = this.getState();
      s.activeCampaignId = id;
      _write(s);
    },

    /** Return the active campaign object, or null. */
    getActiveCampaign: function () {
      var s = this.getState();
      return this.getCampaignById(s.activeCampaignId);
    },

    /** Return a campaign by id, or null. */
    getCampaignById: function (id) {
      var campaigns = this.getCampaigns();
      for (var i = 0; i < campaigns.length; i++) {
        if (campaigns[i].id === id) return campaigns[i];
      }
      return null;
    },

    /**
     * Apply an updater function to the active campaign (or a specific campaign
     * if campaignId is passed) and persist the result.
     */
    updateActiveCampaign: function (updaterFn, campaignId) {
      var s  = this.getState();
      var id = campaignId || s.activeCampaignId;
      s.campaigns = s.campaigns.map(function (c) {
        return c.id === id ? updaterFn(c) : c;
      });
      _write(s);
    },

    /* ---- Campaign-scoped helpers (default to active campaign) ----------- */

    /** Return all deliverables for a campaign (defaults to active). */
    getDeliverables: function (campaignId) {
      var c = campaignId ? this.getCampaignById(campaignId) : this.getActiveCampaign();
      return (c && c.production && c.production.deliverables) ? c.production.deliverables : [];
    },

    /** Return one deliverable by id, or null. */
    getDeliverable: function (id, campaignId) {
      var deliverables = this.getDeliverables(campaignId);
      for (var i = 0; i < deliverables.length; i++) {
        if (deliverables[i].id === id) return deliverables[i];
      }
      return null;
    },

    /** Apply an updater function to one deliverable and persist. */
    updateDeliverable: function (id, updaterFn, campaignId) {
      this.updateActiveCampaign(function (campaign) {
        campaign.production.deliverables = campaign.production.deliverables.map(function (d) {
          return d.id === id ? updaterFn(d) : d;
        });
        return campaign;
      }, campaignId);
    },

    /** Return all asset files for a campaign (defaults to active). */
    getAssets: function (campaignId) {
      var c = campaignId ? this.getCampaignById(campaignId) : this.getActiveCampaign();
      return (c && c.assets && c.assets.files) ? c.assets.files : [];
    },

    /** Return a single asset object by id, or null. */
    getAssetById: function (id, campaignId) {
      var files = this.getAssets(campaignId);
      for (var i = 0; i < files.length; i++) {
        if (files[i].id === id) return files[i];
      }
      return null;
    },

    /**
     * Return the full asset objects linked to a given deliverable id.
     * Derived from deliverable.assetIds — source of truth.
     */
    getAssetsForDeliverable: function (deliverableId, campaignId) {
      var self        = this;
      var deliverable = this.getDeliverable(deliverableId, campaignId);
      if (!deliverable) return [];
      return (deliverable.assetIds || [])
        .map(function (id) { return self.getAssetById(id, campaignId); })
        .filter(Boolean);
    },

    /**
     * Return assets referenced by at least one deliverable.
     * Derived from deliverable.assetIds — source of truth.
     */
    getLinkedAssets: function (campaignId) {
      var c = campaignId ? this.getCampaignById(campaignId) : this.getActiveCampaign();
      if (!c) return [];

      var assetToDeliverables = {};
      (c.production.deliverables || []).forEach(function (d) {
        (d.assetIds || []).forEach(function (aid) {
          if (!assetToDeliverables[aid]) assetToDeliverables[aid] = [];
          assetToDeliverables[aid].push(d.title);
        });
      });

      var campaignName = c.name;
      return (c.assets.files || [])
        .filter(function (f) { return !!assetToDeliverables[f.id]; })
        .map(function (f) {
          var delivTitles = assetToDeliverables[f.id];
          return {
            id:           f.id,
            name:         f.name,
            type:         f.type,
            size:         f.size,
            date:         f.date,
            campaign:     campaignName,
            deliverable:  delivTitles[0],
            deliverables: delivTitles
          };
        });
    },

    /**
     * Link an asset to a deliverable (idempotent).
     */
    linkAssetToDeliverable: function (assetId, deliverableId, campaignId) {
      this.updateActiveCampaign(function (campaign) {
        campaign.production.deliverables = campaign.production.deliverables.map(function (d) {
          if (d.id === deliverableId) {
            var ids = d.assetIds || [];
            if (ids.indexOf(assetId) === -1) {
              d.assetIds = ids.concat([assetId]);
            }
          }
          return d;
        });
        return campaign;
      }, campaignId);
    },

    /**
     * Unlink an asset from a specific deliverable.
     */
    unlinkAssetFromDeliverable: function (assetId, deliverableId, campaignId) {
      this.updateActiveCampaign(function (campaign) {
        campaign.production.deliverables = campaign.production.deliverables.map(function (d) {
          if (d.id === deliverableId) {
            d.assetIds = (d.assetIds || []).filter(function (id) { return id !== assetId; });
          }
          return d;
        });
        return campaign;
      }, campaignId);
    },

    /* ---- Legacy compat --------------------------------------------------- */
    /** @deprecated Use getActiveCampaign() */
    getCampaign: function () { return this.getActiveCampaign(); },
    /** @deprecated Use updateActiveCampaign() */
    setCampaign: function (data) {
      this.updateActiveCampaign(function () { return data; });
    },
    /** @deprecated Use updateActiveCampaign() */
    updateCampaign: function (updaterFn) {
      this.updateActiveCampaign(updaterFn);
    }
  };

  /* ---------- Expose on window.AMEBA.storage.campaign -------------------- */
  window.AMEBA = window.AMEBA || {};
  window.AMEBA.storage = window.AMEBA.storage || {};
  window.AMEBA.storage.campaign = store;

  console.log("[ameba] Campaign store ready (multi-campaign)");

}());
