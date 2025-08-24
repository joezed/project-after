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
	  // remove: el.style.animationDelay = `${index * (STAGGER_MS / 1000)}s`;
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
  function renderTextWithCtx(text, ctx = {}) {
    return text.replace(/\{(\w+)\}/g, (_, k) => {
      const val = (k in ctx) ? ctx[k] : undefined;
      return (val !== undefined && val !== null) ? String(val) : `{${k}}`;
    });
  }

  // NEW: sequential message rendering with a typing indicator between lines
	async function loadMessagesInto(manager, key, ctx = {}) {
	  const res = await fetch("res/messages.json");
	  const data = await res.json();
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
      const res = await fetch("res/flows.json");
      this.flows = await res.json();
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
        if (node.persistKey) localStorage.setItem(node.persistKey, picked);
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
     INIT
     =========================== */
  document.addEventListener("DOMContentLoaded", async () => {
    // Reset
    const resetBtn = document.getElementById("debug-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        try {
          localStorage.removeItem("afterName");
          localStorage.removeItem("afterExName");
          localStorage.removeItem("afterEndDate");
          localStorage.removeItem("afterMood");
        } finally {
          location.reload();
        }
      });
    }

    const container = document.getElementById("messages");
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
    await runner.run(entry);
  });
})();
