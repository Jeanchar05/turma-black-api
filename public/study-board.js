"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./study-curriculum"));
  else root.TurmaBoard = factory(root.TurmaStudy);
})(typeof window !== "undefined" ? window : globalThis, function (C) {
  const wheel = C.wheel;
  const red = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
  ]);
  // A capsule with equal distances along its perimeter. Its long axis follows
  // the available space; the wheel order and the neighbors never change.
  function geometry(width, height) {
    const vertical = height > width,
      short = Math.min(width, height),
      long = Math.max(width, height);
    const r = (short - 56) / 2,
      straight = long - short,
      perimeter = 2 * straight + 2 * Math.PI * r;
    const sample = (distance) => {
      let d = ((distance % perimeter) + perimeter) % perimeter,
        x,
        y;
      if (d < straight) {
        x = r + 28 + d;
        y = 28;
      } else if ((d -= straight) < Math.PI * r) {
        const a = -Math.PI / 2 + d / r;
        x = long - r - 28 + r * Math.cos(a);
        y = short / 2 + r * Math.sin(a);
      } else if ((d -= Math.PI * r) < straight) {
        x = long - r - 28 - d;
        y = short - 28;
      } else {
        d -= straight;
        const a = Math.PI / 2 + d / r;
        x = r + 28 + r * Math.cos(a);
        y = short / 2 + r * Math.sin(a);
      }
      return vertical ? { x: y, y: long - x } : { x, y };
    };
    const offset = vertical ? straight + (Math.PI * r) / 2 : (-Math.PI * r) / 2;
    // Spacing uses the maximum x/y travel so square pockets stay separate,
    // including the diagonal portions of the end caps.
    const samples = [];
    let distance = 0,
      previous = null;
    for (let i = 0; i <= 2400; i++) {
      const p = sample(offset + (i * perimeter) / 2400);
      if (previous)
        distance += Math.max(
          Math.abs(p.x - previous.x),
          Math.abs(p.y - previous.y),
        );
      samples.push({ ...p, distance });
      previous = p;
    }
    const points = wheel.map((n, i) => ({
      n,
      ...samples.find((p) => p.distance >= (distance * i) / 37),
    }));
    const outline = Array.from({ length: 185 }, (_, i) =>
      sample(offset + (i * perimeter) / 185),
    );
    return {
      points,
      path:
        outline
          .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
          .join(" ") + " Z",
    };
  }
  function markup({ mode = "race", name = "", id = "" } = {}) {
    const numbers =
      mode === "race" ? wheel : Array.from({ length: 37 }, (_, i) => i);
    return `<div ${id ? `id="${id}"` : ""} class="primo-board" data-primo-board data-layout="${mode === "race" ? "race" : "table"}" role="group" aria-label="${mode === "race" ? "Race: ordem da roda europeia" : "Mesa de números: três colunas e doze linhas"}">
      <div class="primo-board-surface"><svg class="primo-board-lines" aria-hidden="true"><path class="primo-board-rail"/><path class="primo-board-rail-detail"/><path class="primo-board-connection"/></svg>
      <div class="primo-board-center" aria-hidden="true"><span>ORDEM DA RODA</span><strong>Race<span>·</span></strong><small>EUROPEIA · 37 NÚMEROS</small><i>Toque para explorar</i></div>
      ${numbers.map((n) => `<button type="button" class="primo-pocket ${n === 0 ? "is-zero" : red.has(n) ? "is-red" : "is-black"}" data-number="${n}" ${name ? `data-board="${name}"` : ""} style="--table-column:${n ? Math.ceil(n / 3) + 1 : 1};--table-row:${n ? 4 - (((n - 1) % 3) + 1) : 1};--table-mobile-column:${n ? ((n - 1) % 3) + 1 : 1};--table-mobile-row:${n ? Math.ceil(n / 3) + 1 : 1}" aria-label="Número ${n}" aria-pressed="false"><span>${n}</span></button>`).join("")}</div>
      <div class="primo-table-labels" aria-hidden="true"><span>1ª dúzia · 1–12</span><span>2ª dúzia · 13–24</span><span>3ª dúzia · 25–36</span></div></div>`;
  }
  function draw(root) {
    if (!root.isConnected) {
      root.__boardObserver?.disconnect();
      return;
    }
    const surface = root.querySelector(".primo-board-surface");
    const w = surface.clientWidth,
      h = surface.clientHeight;
    if (!w || !h || root.dataset.layout !== "race") return;
    const { points, path } = geometry(w, h),
      svg = root.querySelector("svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    for (const selector of [".primo-board-rail", ".primo-board-rail-detail"])
      svg.querySelector(selector).setAttribute("d", path);
    for (const p of points) {
      const button = root.querySelector(`[data-number="${p.n}"]`);
      button.style.left = p.x + "px";
      button.style.top = p.y + "px";
    }
    const links = (root.__connections || [])
      .map((n) => points.find((p) => p.n === n))
      .filter(Boolean);
    svg
      .querySelector(".primo-board-connection")
      .setAttribute(
        "d",
        links.length > 1
          ? links.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ") +
              (links.length > 2 ? " Z" : "")
          : "",
      );
  }
  function mount(root) {
    if (!root || root.__boardObserver) return;
    root.__boardObserver = new ResizeObserver(() => draw(root));
    root.__boardObserver.observe(root);
    draw(root);
    root.addEventListener("keydown", (event) => {
      const button = event.target.closest("[data-number]");
      if (
        !button ||
        ![
          "ArrowRight",
          "ArrowLeft",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ].includes(event.key)
      )
        return;
      const buttons = [
        ...root.querySelectorAll("[data-number]:not(:disabled)"),
      ];
      let index = buttons.indexOf(button),
        delta = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
      if (
        root.dataset.layout === "table" &&
        ["ArrowUp", "ArrowDown"].includes(event.key)
      )
        delta *= 3;
      index =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (index + delta + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[index]?.focus();
    });
  }
  function connect(root, numbers) {
    if (root) {
      root.__connections = numbers;
      draw(root);
    }
  }
  function destroy(root) {
    root?.__boardObserver?.disconnect();
  }
  return { wheel, red, geometry, markup, mount, connect, destroy };
});
