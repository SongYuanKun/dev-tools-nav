import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

class Element {
  constructor() { this.children = []; this.listeners = new Map(); this.classList = { add() {}, remove() {} }; this.style = {}; this.offsetWidth = 300; this.offsetHeight = 160; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  click() { this.listeners.get("click")?.(); }
  querySelector(selector) { this.nodes ??= new Map(); if (!this.nodes.has(selector)) this.nodes.set(selector, new Element()); return this.nodes.get(selector); }
}

test("a completed or skipped tour can be reopened only through the explicit start control", async () => {
  const button = new Element();
  const body = new Element();
  const document = {
    readyState: "complete",
    body,
    createElement: () => new Element(),
    querySelector: () => null,
    querySelectorAll: (selector) => selector === "[data-start-tour]" ? [button] : [],
  };
  const window = { innerWidth: 1200, innerHeight: 800, addEventListener() {} };
  const context = { window, document, localStorage: { getItem: () => JSON.stringify({ v: 1, completedSteps: 4 }), setItem() {} }, setTimeout: (callback) => callback(), requestAnimationFrame: (callback) => callback() };
  vm.runInNewContext(await readFile(new URL("../js/tour.js", import.meta.url), "utf8"), context);
  assert.equal(body.children.length, 0);
  button.click();
  assert.equal(body.children.length, 2);
});
