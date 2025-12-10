// Wrap everything so duplicate <script> tags can't double-init
(() => {
  if (window.__AFTER_INIT__) return;
  window.__AFTER_INIT__ = true;

  /* ===========================
     CONFIG
     =========================== */
  const STAGGER_MS = 1500;          // (Doubled) gap between lines starting
  const HOLD_AFTER_SCREEN_MS = 2000; // 2s hold before fade
  const SCREEN_FADE_MS = 1600;       // match .screen transition
  const LINE_FADEIN_MS = 1000;       // match CSS keyframe duration
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  /* ===========================
     JOURNAL (Release 0.2)
     =========================== */
  const JOURNAL_KEY = 'afterJournal';

  function getTodayKey() {
    const d = new Date();
    return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  function getJournal() {
    try {
      const raw = localStorage.getItem(JOURNAL_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function hasTodayEntry() {
    const today = getTodayKey();
    return getJournal().some(e => e.date === today);
  }

  function saveJournalEntry(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return { ok: false, reason: 'empty' };

    const today = getTodayKey();
    const journal = getJournal().filter(e => e.date !== today); // de-dup per day
    journal.push({ date: today, text: trimmed });
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
    return { ok: true };
  }

  function clearJournal() {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify([]));
  }

  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Prompt overlay (appears after mood is logged)
  function openJournalPrompt() {
    if (hasTodayEntry()) return; // skip if already saved today

    const overlay = document.getElementById('journal-overlay');
    const textarea = document.getElementById('journal-textarea');
    const confirm = document.getElementById('journal-submit');
    const skip = document.getElementById('journal-skip');
    const notice = document.getElementById('journal-notice');

    if (!overlay || !textarea || !confirm || !skip || !notice) return;
    textarea.value = '';
    notice.textContent = '';
    overlay.classList.remove('hidden');

    confirm.onclick = () => {
      const res = saveJournalEntry(textarea.value);
      if (!res.ok) {
        notice.textContent = 'Please write something or choose "not today".';
        return;
      }
      notice.textContent = 'Saved ✓';
      setTimeout(() => closeJournalPrompt(), 600);
    };

    skip.onclick = () => {
      closeJournalPrompt();
    };

    const onKey = (e) => (e.key === 'Escape' ? closeJournalPrompt() : null);
    overlay.addEventListener('keydown', onKey, { once: true });
    textarea.focus();
  }

  function closeJournalPrompt() {
    const overlay = document.getElementById('journal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // Journal list overlay
  function openJournalList() {
    const overlay = document.getElementById('journal-list-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    renderJournalList();
  }

  function closeJournalList() {
    const overlay = document.getElementById('journal-list-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  function renderJournalList() {
    const listEl = document.getElementById('journal-list');
    const countEl = document.getElementById('journal-count');
    if (!listEl || !countEl) return;

    const items = getJournal().slice().sort((a, b) => (a.date < b.date ? 1 : -1)); // reverse-chronological
    countEl.textContent = `${items.length} entr${items.length === 1 ? 'y' : 'ies'}`;

    const frag = document.createDocumentFragment();

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'journal-empty muted';
      empty.textContent = "No entries yet. You'll be prompted after logging your mood.";
      frag.appendChild(empty);
    } else {
      for (const { date, text } of items) {
        const row = document.createElement('article');
        row.className = 'journal-item';
        row.setAttribute('role', 'listitem');

        const h = document.createElement('header');
        h.className = 'journal-item-head';

        const d = document.createElement('div');
        d.className = 'journal-item-date';
        d.textContent = formatDate(date);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-ghost xsmall';
        copyBtn.textContent = 'Copy';
        copyBtn.title = 'Copy entry text';
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(text);
            copyBtn.textContent = 'Copied ✓';
            setTimeout(() => (copyBtn.textContent = 'Copy'), 800);
          } catch {}
        });

        h.appendChild(d);
        h.appendChild(copyBtn);

        const body = document.createElement('p');
        body.className = 'journal-item-text';
        const preview = text.length > 240 ? text.slice(0, 240) + '…' : text;
        body.textContent = preview;
        body.title = text;

        row.appendChild(h);
        row.appendChild(body);
        frag.appendChild(row);
      }
    }

    listEl.innerHTML = '';
    listEl.appendChild(frag);
  }

  function exportJournal() {
    const data = getJournal().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'after-journal.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function wireJournalUI() {
    const openBtn = document.getElementById('journal-open');
    const closeBtn = document.getElementById('journal-close');
    const exportBtn = document.getElementById('journal-export');
    const clearBtn = document.getElementById('journal-clear');
    const overlay = document.getElementById('journal-list-overlay');

    openBtn?.addEventListener('click', openJournalList);
    closeBtn?.addEventListener('click', closeJournalList);
    exportBtn?.addEventListener('click', exportJournal);
    clearBtn?.addEventListener('click', () => {
      if (confirm('Delete all journal entries?')) {
        clearJournal();
        renderJournalList();
      }
    });
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) closeJournalList();
    });
  }

  // convenience so other code can trigger the prompt
  function onDailyMoodLogged() {
    openJournalPrompt();
  }

  /* ===========================
     SCREEN MANAGER
     =========================== */
  class ScreenManager {
    constructor(root) {
      this.root = root;
      this.currentScreen = null;
      this.isTransitioning = false;
      this.hintShown = false;
    }
    startScreen() {
      const screen = document.createElement("div");
      screen.className = "screen";
      this.root.appendChild(screen);
      this.currentScreen = screen;
      return screen;
    }
    appendLine(text) {
      if (!this.currentScreen) this.startScreen();
      const el = document.createElement("p");
      el.className = "message";
      el.textContent = text;
      this.currentScreen.appendChild(el);
      this._checkForOverflow();
      return el;
    }
    appendNode(node, index = 0) {
      if (!this.currentScreen) this.startScreen();
      node.style.animationDelay = `${index * (STAGGER_MS / 1000)}s`;
      this.currentScreen.appendChild(node);
      this._checkForOverflow();
      return node;
    }
    async waitForScreenFadeIn(totalItems) {
      const total = (totalItems - 1) * STAGGER_MS + LINE_FADEIN_MS;
      if (total > 0) await wait(total);
    }
    async fadeOutAndClear() {
      if (!this.currentScreen || this.isTransitioning) return;
      this.isTransitioning = true;
      await wait(HOLD_AFTER_SCREEN_MS); // 2s hold
      this.currentScreen.classList.add("screen--fading");
      await wait(SCREEN_FADE_MS);
      this.currentScreen.remove();
      this.currentScreen = null;
      this.isTransitioning = false;
    }
    _checkForOverflow() {
      if (!this.hintShown && this.root.scrollHeight > this.root.clientHeight) {
        const hint = document.getElementById("scroll-hint");
        if (hint) {
          hint.classList.add("show");
          setTimeout(() => hint.classList.remove("show"), 4000);
        }
        this.hintShown = true;
      }
    }
  }

  /* ===========================
     TEMPLATE + DATA LOADING
     =========================== */
  const BUILTIN_MESSAGES = {
    intro_first: [
      "hey",
      "welcome to after.",
      "we're glad you're here.",
      "don't think we've met before...",
      "who are we speaking to?"
    ],
    intro_after_name: [
      "nice to meet you, {name}",
      "we know you probably didn't want to be here...",
      "but here you are, so let us help",
      "you should be so proud you've made this step"
    ],
    intro_ex_prompt: [
      "to really personalise your experience, it might help to know the other person",
      "you don't have to, {name}, but we promise this is private to you",
      "if you'd like to tell us, tell us now"
    ],
    intro_ex_provided: [
      "thanks, that was brave, we're proud of you"
    ],
    intro_ex_skipped: [
      "hey, that's fine. we get it's hard",
      "we're not here to judge, just help, we hope"
    ],
    end_date_intro: [
      "it can sometimes help to know how far you've come",
      "please give us a date when you and {ex} broke up"
    ],
    post_date_next: [
      "this will help you realise how well you're doing",
      "day 0 or day 100, it helps to know everything is now behind you",
      "do you want to hear more about what 'after' is all about?",
      "or would you rather get straight into it"
    ],
    more_info: [
      "after is designed to be deleted, {name}",
      "we want to be so good, you don't need us eventually",
      "if you use us for a few days, or a few months, or longer, we don't actually care",
      "we'd rather you get over this break up in the best way possible for you",
      "using journalling, emotion tracking, articles and more, we want you to heal and build, and come out from this...",
      "stronger",
      "happier",
      "healed",
      "sound good to you?",
      "let's get started :)"
    ],
    intro_returning: [
      "hey, {name}",
      "welcome back to after."
    ],
    main_emotion_check: [
      "how's it going today?"
    ]
  };

  const BUILTIN_FLOWS = {
    firstTime: [
      { type: "messages", key: "intro_first", autofade: true },
      { type: "input", id: "name", placeholder: "your name", persistKey: "afterName" },
      { type: "messages", key: "intro_after_name", bind: ["name"], autofade: true },
      { type: "messages", key: "intro_ex_prompt", bind: ["name"], autofade: true },
      { type: "rowInput", id: "ex", placeholder: "their name", skipLabel: "skip", defaultOnSkip: "them", persistKey: "afterExName" },
      { type: "branch", when: "exProvided", ifTrue: "exProvided", ifFalse: "exSkipped" }
    ],
    exProvided: [
      { type: "messages", key: "intro_ex_provided", autofade: true },
      { type: "goto", to: "collectDate" }
    ],
    exSkipped: [
      { type: "messages", key: "intro_ex_skipped", autofade: true },
      { type: "goto", to: "collectDate" }
    ],
    collectDate: [
      { type: "messages", key: "end_date_intro", bind: ["ex"], autofade: true },
      { type: "dateInput", id: "endDate", persistKey: "afterEndDate" },
      { type: "messages", key: "post_date_next", bind: ["ex"], autofade: true },
      { type: "goto", to: "moreInfo" }
    ],
    moreInfo: [
      { type: "messages", key: "more_info", bind: ["name"] },
      { type: "goto", to: "moodCheck" }
    ],
    moodCheck: [
      { type: "messages", key: "main_emotion_check" },
      {
        type: "choice",
        id: "mood",
        persistKey: "afterMood",
        options: [
          { label: "😊", value: "happy" },
          { label: "😑", value: "neutral" },
          { label: "😔", value: "down" },
          { label: "😭", value: "sad" },
          { label: "😡", value: "angry" }
        ]
      }
    ],
    returning: [
      { type: "messages", key: "intro_returning", bind: ["name"], autofade: true },
      { type: "goto", to: "moodCheck" }
    ]
  };

  function renderTextWithCtx(text, ctx = {}) {
    return text.replace(/\{(\w+)\}/g, (_, k) => {
      const val = (k in ctx) ? ctx[k] : undefined;
      return (val !== undefined && val !== null) ? String(val) : `{${k}}`;
    });
  }

  const clone = (val) => (typeof structuredClone === 'function'
    ? structuredClone(val)
    : JSON.parse(JSON.stringify(val)));

  // Some hosts ship strict CSP rules that block fetching or evaluating local JSON
  // bundles. To avoid tripping `unsafe-eval` warnings and 404s, we use the
  // embedded definitions by default and only reach for remote JSON if an opt-in
  // flag is explicitly set in the page.
  const USE_REMOTE_JSON = Boolean(document.body?.dataset?.useRemoteJson);

  async function getMessagesData() {
    if (!USE_REMOTE_JSON) return clone(BUILTIN_MESSAGES);
    try {
      const res = await fetch("res/messages.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("after: messages.json unavailable, using bundled data", err);
      return clone(BUILTIN_MESSAGES);
    }
  }

  async function getFlowsData() {
    if (!USE_REMOTE_JSON) return clone(BUILTIN_FLOWS);
    try {
      const res = await fetch("res/flows.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("after: flows.json unavailable, using bundled data", err);
      return clone(BUILTIN_FLOWS);
    }
  }

  // Sequential message rendering with a typing indicator between lines
  async function loadMessagesInto(manager, key, ctx = {}) {
    const data = await getMessagesData();
    let messages = data[key] || [];
    messages = messages.map(m => renderTextWithCtx(m, ctx));

    manager.startScreen();

    for (let i = 0; i < messages.length; i++) {
      // show the real message
      manager.appendLine(messages[i], 0);

      // if another message is coming, show typing line
      if (i < messages.length - 1) {
        const typingEl = document.createElement("p");
        typingEl.className = "message typing";
        typingEl.textContent = "...";
        manager.appendNode(typingEl, 0);

        // keep typing on for the stagger window
        await wait(STAGGER_MS);

        // remove typing before next real line
        typingEl.remove();
      }
    }
  }

  /* ===========================
     UI HELPERS
     =========================== */
  const ui = {
    textInput(manager, placeholder = "Type...") {
      return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = placeholder;
        input.className = "message-input";
        manager.appendNode(input, 0);
        input.focus();
        const onEnter = (e) => {
          if (e.key !== "Enter") return;
          const val = input.value.trim();
          if (!val) return;
          input.disabled = true;
          input.removeEventListener("keypress", onEnter);
          resolve(val);
        };
        input.addEventListener("keypress", onEnter);
      });
    },

    rowInput(manager, placeholder = "Type...", skipLabel = "Skip") {
      return new Promise(resolve => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "0.5rem";
        row.style.marginTop = "1rem";
        row.style.alignItems = "center";
        row.style.width = "min(500px, 90vw)";

        const exInput = document.createElement("input");
        exInput.type = "text";
        exInput.placeholder = placeholder;
        exInput.className = "message-input";

        const skipBtn = document.createElement("button");
        skipBtn.textContent = skipLabel;
        skipBtn.className = "message-input";
        skipBtn.style.border = "1px solid #fff";
        skipBtn.style.padding = "0.3rem 0.6rem";
        skipBtn.style.cursor = "pointer";

        row.appendChild(exInput);
        row.appendChild(skipBtn);
        manager.appendNode(row, 0);
        exInput.focus();

        const finish = (value, skipped) => {
          exInput.disabled = true;
          skipBtn.disabled = true;
          resolve({ value, skipped });
        };

        exInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter" && exInput.value.trim() !== "") {
            finish(exInput.value.trim(), false);
          }
        });
        skipBtn.addEventListener("click", () => finish("", true));
      });
    },

    dateInput(manager) {
      return new Promise(resolve => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "0.5rem";
        row.style.marginTop = "1rem";
        row.style.alignItems = "center";
        row.style.width = "min(500px, 90vw)";

        const dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.className = "message-input";
        dateInput.placeholder = "Select date";

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save date";
        saveBtn.className = "message-input";
        saveBtn.style.border = "1px solid #fff";
        saveBtn.style.padding = "0.3rem 0.6rem";
        saveBtn.style.cursor = "pointer";
        saveBtn.disabled = true;
        saveBtn.style.opacity = "0.7";
        saveBtn.style.pointerEvents = "none";

        row.appendChild(dateInput);
        row.appendChild(saveBtn);
        manager.appendNode(row, 0);
        dateInput.focus();

        const enableIfValid = () => {
          if (dateInput.value) {
            saveBtn.disabled = false; saveBtn.style.opacity = "1"; saveBtn.style.pointerEvents = "auto";
          } else {
            saveBtn.disabled = true; saveBtn.style.opacity = "0.7"; saveBtn.style.pointerEvents = "none";
          }
        };
        dateInput.addEventListener("input", enableIfValid);
        enableIfValid();

        const commit = () => {
          if (!dateInput.value) return;
          dateInput.disabled = true; saveBtn.disabled = true;
          resolve(dateInput.value); // YYYY-MM-DD
        };
        dateInput.addEventListener("keypress", (e) => { if (e.key === "Enter" && dateInput.value) commit(); });
        saveBtn.addEventListener("click", commit);
      });
    },

    // Compact inline choice buttons (emoji row etc.)
    choice(manager, options) {
      return new Promise(resolve => {
        const row = document.createElement("div");
        row.className = "choice-row"; // styled in CSS

        options.forEach(opt => {
          const btn = document.createElement("button");
          btn.className = "choice-button";
          btn.textContent = opt.label;
          btn.addEventListener("click", () => {
            options.forEach(o => o.__btn && (o.__btn.disabled = true));
            resolve(opt.value);
          });
          opt.__btn = btn;
          row.appendChild(btn);
        });

        manager.appendNode(row, 0);
      });
    }
  };

  /* ===========================
     FLOW RUNNER
     =========================== */
  class FlowRunner {
    constructor(manager) {
      this.mgr = manager;
      this.ctx = {};
      this.flows = null;
    }

    async loadFlows() {
      if (this.flows) return this.flows;
      this.flows = await getFlowsData();
      return this.flows;
    }

    async step(node) {
      // messages
      if (node.type === "messages") {
        let boundCtx = { ...this.ctx };
        if (Array.isArray(node.bind)) {
          boundCtx = node.bind.reduce((acc, k) => { if (k in this.ctx) acc[k] = this.ctx[k]; return acc; }, {});
        }
        await loadMessagesInto(this.mgr, node.key, boundCtx);
        if (node.sticky) return;
        if (node.autofade) await this.mgr.fadeOutAndClear();
        return;
      }

      // text input
      if (node.type === "input") {
        const val = await ui.textInput(this.mgr, node.placeholder || "Type...");
        this.ctx[node.id] = val;
        if (node.persistKey) localStorage.setItem(node.persistKey, val);
        if (node.id === "name") localStorage.setItem("afterName", val);
        await this.mgr.fadeOutAndClear();
        return;
      }

      // row input (with skip default)
      if (node.type === "rowInput") {
        const { value, skipped } = await ui.rowInput(
          this.mgr,
          node.placeholder || "Type...",
          node.skipLabel || "Skip"
        );
        const finalVal = skipped ? (node.defaultOnSkip || "them") : value;
        this.ctx[node.id] = finalVal;
        this.ctx[`${node.id}Provided`] = !skipped; // e.g., exProvided
        if (node.persistKey) localStorage.setItem(node.persistKey, finalVal);
        if (node.id === "ex") localStorage.setItem("afterExName", finalVal);
        await this.mgr.fadeOutAndClear();
        return;
      }

      // date input
      if (node.type === "dateInput") {
        const dateStr = await ui.dateInput(this.mgr);
        this.ctx[node.id] = dateStr;
        if (node.persistKey) localStorage.setItem(node.persistKey, dateStr);
        await this.mgr.fadeOutAndClear();
        return;
      }

      // choice buttons
      if (node.type === "choice") {
        const picked = await ui.choice(this.mgr, node.options || []);
        this.ctx[node.id] = picked;
        if (node.persistKey) {
          localStorage.setItem(node.persistKey, picked);

          // If this is the daily mood save, fire the journal prompt
          if (node.persistKey === 'afterMood') {
            onDailyMoodLogged();
          }
        }
        await this.mgr.fadeOutAndClear();
        return;
      }

      // branch
      if (node.type === "branch") {
        if (node.cases && typeof node.cases === "object") {
          const v = this.ctx[node.when];
          return node.cases[v] || node.else;
        }
        const cond = this.ctx[node.when];
        return cond ? node.ifTrue : node.ifFalse;
      }

      // goto
      if (node.type === "goto") {
        return node.to;
      }
    }

    async run(sequenceName) {
      const flows = await this.loadFlows();
      let seq = flows[sequenceName];
      if (!seq) return;
      let i = 0;
      while (i < seq.length) {
        const jump = await this.step(seq[i]);
        if (typeof jump === "string") {
          seq = flows[jump];
          i = 0;
          continue;
        }
        i++;
      }
    }
  }

  /* ===========================
     CUSTOM ACTIONS (optional)
     =========================== */
  function dispatchCustomAction(name) {
    switch (name) {
      case 'open_journal':
        openJournalList();
        break;
      case 'export_journal':
        exportJournal();
        break;
      case 'clear_journal':
        if (confirm('Delete all journal entries?')) {
          clearJournal();
          renderJournalList();
        }
        break;
      default:
        console.warn('Unknown custom action:', name);
    }
  }
  // If your flow engine emits action strings like "custom:open_journal"
  window.onFlowAction = function(action) {
    if (typeof action !== 'string') return;
    if (action.startsWith('custom:')) {
      dispatchCustomAction(action.split(':', 2)[1]);
      return;
    }
    // otherwise, your engine should handle built-ins like "next:screenId"
  };

  /* ===========================
     INIT
     =========================== */
  document.addEventListener("DOMContentLoaded", async () => {
    // hook up Journal header/overlay controls (if present in app.html)
    wireJournalUI();

    // Reset
    const resetBtn = document.getElementById("debug-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        try {
          localStorage.removeItem("afterName");
          localStorage.removeItem("afterExName");
          localStorage.removeItem("afterEndDate");
          localStorage.removeItem("afterMood");
          // keep journal by default; comment-in to nuke:
          // localStorage.removeItem(JOURNAL_KEY);
        } finally {
          location.reload();
        }
      });
    }

    const container = document.getElementById("messages") || document.getElementById("conversation");
    if (!container) {
      console.error("after: conversation container not found (expected #messages or #conversation)");
      return;
    }

    const mgr = new ScreenManager(container);
    const runner = new FlowRunner(mgr);

    // Seed context from storage (useful for returning flows)
    const storedName = localStorage.getItem("afterName");
    const storedEx = localStorage.getItem("afterExName");
    const storedEndDate = localStorage.getItem("afterEndDate");
    const storedMood = localStorage.getItem("afterMood");
    if (storedName) runner.ctx.name = storedName;
    if (storedEx) runner.ctx.ex = storedEx;
    if (storedEndDate) runner.ctx.endDate = storedEndDate;
    if (storedMood) runner.ctx.mood = storedMood;

    // Choose entry flow
    const entry = storedName ? "returning" : "firstTime";
    try {
      await runner.run(entry);
    } catch (err) {
      console.error('after: failed to start conversation flow', err);
      const fallback = document.createElement('div');
      fallback.className = 'message error';
      fallback.textContent = 'We hit a problem starting the conversation. Please refresh and try again.';
      container.appendChild(fallback);
    }
  });
})();
