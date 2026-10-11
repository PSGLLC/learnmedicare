import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/SearchModal.astro', import.meta.url), 'utf8');
function fixture() {
  const handlers = {};
  const scripts = [];
  const state = {modal: false};
  const input = {tagName: 'INPUT', focus() {document.activeElement = this;}};
  const toggle = {tagName: 'BUTTON', setAttribute() {}, focus() {document.activeElement = this;},
    addEventListener(type, fn) {handlers[`toggle:${type}`] = fn;}};
  const panel = {hidden: true, querySelector() {return scripts.length ? input : null;}};
  const wrap = {contains(e) {return e === input || e === toggle;}};
  const outside = {tagName: 'BUTTON'};
  const document = {activeElement: outside, head: {appendChild() {}}, body: {appendChild(s) {scripts.push(s);}},
    querySelector(selector) {return selector === '.search-wrap' ? wrap : state.modal;},
    getElementById(id) {return id === 'search-toggle' ? toggle : panel;},
    createElement() {return {};}, addEventListener(type, fn, capture) {handlers[type] = fn; handlers[`${type}:capture`] = capture;}};
  vm.runInNewContext(source.match(/<script is:inline>([\s\S]*?)<\/script>/)[1], {document, window: {}});
  return {panel, input, toggle, outside, document, state, scripts, handlers,
    click() {document.activeElement = toggle; handlers['toggle:click']();},
    key(key, props = {}) {let prevented = false; handlers.keydown({key, ...props, preventDefault() {prevented = true;}}); return prevented;}};
}

test('late search script completion cannot focus a hidden input or interrupt a modal', () => {
  for (const block of ['closed', 'modal']) {
    const f = fixture(); f.click();
    if (block === 'closed') f.key('Escape'); else f.state.modal = true;
    f.document.activeElement = f.outside; f.scripts[0].onload();
    assert.equal(f.document.activeElement, f.outside);
  }
});

test('search shortcuts leave editable controls and native dialogs alone', () => {
  for (const active of [{tagName: 'INPUT'}, {tagName: 'TEXTAREA'}, {tagName: 'SELECT'}, {tagName: 'DIV', isContentEditable: true}]) {
    const f = fixture(); f.document.activeElement = active;
    assert.equal(f.key('/'), false); assert.equal(f.key('k', {ctrlKey: true}), false);
    assert.equal(f.panel.hidden, true);
  }
  const f = fixture(); f.state.modal = true; assert.equal(f.key('/'), false); assert.equal(f.panel.hidden, true);
});

test('Escape closes search but restores the toggle only when focus belongs to search', () => {
  const inside = fixture(); inside.click(); inside.document.activeElement = inside.input; inside.key('Escape');
  assert.equal(inside.panel.hidden, true); assert.equal(inside.document.activeElement, inside.toggle);
  const outside = fixture(); outside.click(); outside.document.activeElement = outside.outside; outside.key('Escape');
  assert.equal(outside.panel.hidden, true); assert.equal(outside.document.activeElement, outside.outside);
});

test('Escape focus ownership is captured before Pagefind blurs its input', () => {
  const f = fixture();
  assert.equal(f.handlers['keydown:capture'], true);
  f.click(); f.document.activeElement = f.input; f.key('Escape');
  // Pagefind's later input.blur() cannot blur the newly focused toggle.
  if (f.document.activeElement === f.input) f.document.activeElement = f.outside;
  assert.equal(f.document.activeElement, f.toggle);
});

test('non-editing shortcuts still open search and reuse the lazy script', () => {
  const f = fixture(); assert.equal(f.key('/'), true); f.scripts[0].onload();
  assert.equal(f.document.activeElement, f.input); f.key('Escape');
  assert.equal(f.key('k', {ctrlKey: true}), true); assert.equal(f.scripts.length, 1);
});
