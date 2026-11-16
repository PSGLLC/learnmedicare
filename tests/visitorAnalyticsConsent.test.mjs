import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = readFileSync(new URL("../public/js/visitor-analytics-consent.js", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/components/VisitorAnalyticsConsent.astro", import.meta.url), "utf8");

function runConsentScript() {
  const handlers = {};
  const attributes = {};
  let focusCount = 0;
  let writes = 0;
  const firstPanelButton = { focus() { focusCount += 1; } };
  const panel = { hidden: true, querySelector() { return firstPanelButton; } };
  const preferences = {
    addEventListener(type, handler) { handlers[`preferences:${type}`] = handler; },
    setAttribute(name, value) { attributes[name] = value; },
    focus() { focusCount += 1; },
  };
  const document = {
    getElementById(id) {
      return id === "visitor-analytics-choice" ? panel : preferences;
    },
    querySelectorAll() { return []; },
    addEventListener(type, handler) { handlers[`document:${type}`] = handler; },
    body: { appendChild() {} },
    createElement() { return {}; },
  };
  const consent = { essential: true, analytics: false };
  const window = { __psgConsent: consent };
  const localStorage = {
    getItem() { return null; },
    setItem() { writes += 1; },
  };
  vm.runInNewContext(script, { document, window, localStorage, Date, JSON, Object });
  return { panel, preferences, handlers, attributes, firstPanelButton, window, consent, writes: () => writes, focusCount: () => focusCount };
}

test("Escape closes the nonmodal preferences panel without recording or changing consent and restores trigger focus", () => {
  const state = runConsentScript();
  assert.equal(state.panel.hidden, false, "the initial unanswered preferences are visible");
  assert.equal(state.attributes["aria-expanded"], "true");
  const consentBeforeEscape = state.window.__psgConsent;

  let prevented = false;
  state.handlers["document:keydown"]({ key: "Escape", preventDefault() { prevented = true; } });

  assert.equal(prevented, true);
  assert.equal(state.panel.hidden, true);
  assert.equal(state.attributes["aria-expanded"], "false");
  assert.equal(state.focusCount(), 1, "focus returns to the Privacy Preferences trigger");
  assert.equal(state.writes(), 0, "Escape does not save a consent choice");
  assert.equal(state.window.__psgConsent, consentBeforeEscape, "Escape leaves the live consent object unchanged");

  state.handlers["preferences:click"]();
  assert.equal(state.panel.hidden, false, "the panel remains available from its trigger");
  assert.equal(state.attributes["aria-expanded"], "true");
  assert.equal(state.focusCount(), 2, "opening from the trigger focuses the first preference control");
});

test("preferences remain a nonmodal section with a programmatically associated trigger", () => {
  assert.match(component, /<section id="visitor-analytics-choice" aria-label="Privacy preferences" hidden>/);
  assert.doesNotMatch(component, /aria-modal|role="dialog"/);
  assert.match(component, /id="visitor-analytics-preferences" aria-controls="visitor-analytics-choice" aria-expanded="false"/);
});
