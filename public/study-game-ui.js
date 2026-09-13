"use strict";
(() => {
  const safe = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  window.TurmaStudyGameUI = {
    render(host, q, initial, checked, onChange) {
      let answer = [...initial],
        source = null,
        observing = !answer.length;
      const button = (value, label, selected = false, extra = "") =>
        `<button type="button" class="learn-puzzle-choice${selected ? " is-selected" : ""}" data-value="${safe(value)}" aria-pressed="${selected}" ${checked ? "disabled" : ""} ${extra}>${safe(label)}</button>`;
      function draw() {
        host.className = `learn-puzzle puzzle-${q.kind}`;
        if (q.kind === "gemeos")
          host.innerHTML = `<div class="learn-decision-list">${q.choices.map(([v, label]) => button(v, label, answer.includes(v))).join("")}</div>`;
        if (q.kind === "espelhos")
          host.innerHTML = `<p class="learn-puzzle-instruction" role="status">${source === null ? "Escolha a origem de uma conexão." : `Agora escolha o espelho de ${source}.`}</p><div class="learn-match-columns"><div>${q.left
            .map((n) => {
              const pair = answer.find((v) => v.startsWith(n + ":"));
              return button(
                n,
                `${n}${pair ? ` → ${pair.split(":")[1]}` : ""}`,
                pair !== undefined || source === n,
                'data-side="left"',
              );
            })
            .join("")}</div><span aria-hidden="true">↔</span><div>${q.right
            .map((n) =>
              button(
                n,
                n,
                answer.some((v) => v.endsWith(":" + n)),
                'data-side="right"',
              ),
            )
            .join("")}</div></div>`;
        if (q.kind === "fibonacci")
          host.innerHTML = `<div class="learn-code-grid">${[0, 1]
            .map(
              (pair) =>
                `<fieldset><legend>Par ${pair + 1} · ${q.shown[pair * 2]} e ${q.shown[pair * 2 + 1]}</legend>${[
                  0, 1,
                ]
                  .map((diff) => {
                    const i = pair * 2 + diff;
                    return `<label>${diff ? "Diferença absoluta" : "Soma"}<input type="number" inputmode="numeric" min="0" max="36" step="1" data-answer-index="${i}" value="${answer[i] === "fora" ? "" : safe(answer[i] || "")}" ${checked || answer[i] === "fora" ? "disabled" : ""}></label>${!diff ? `<label class="learn-code-out"><input type="checkbox" data-outside="${i}" ${answer[i] === "fora" ? "checked" : ""} ${checked ? "disabled" : ""}> Fora da roda (&gt;36)</label>` : ""}`;
                  })
                  .join("")}</fieldset>`,
            )
            .join("")}</div>`;
        if (q.kind === "magneto") {
          const points = q.nodes.map((n, i) => ({
            n,
            x: 50 + 41 * Math.sin((i * 2 * Math.PI) / q.nodes.length),
            y: 50 - 41 * Math.cos((i * 2 * Math.PI) / q.nodes.length),
          }));
          host.innerHTML = `<div class="learn-circuit"><svg viewBox="0 0 100 100" aria-hidden="true">${points.map((p) => `<line x1="50" y1="50" x2="${p.x}" y2="${p.y}" class="${answer.includes(String(p.n)) ? "is-on" : ""}"/>`).join("")}</svg><strong class="learn-circuit-source">${q.shown[0]}<small>ORIGEM</small></strong>${points.map((p) => button(p.n, p.n, answer.includes(String(p.n)), `style="left:${p.x}%;top:${p.y}%"`)).join("")}</div><p class="learn-puzzle-instruction">${answer.length} conexão(ões) ativada(s).</p>`;
        }
        if (q.kind === "camaleoes")
          host.innerHTML = `<fieldset class="learn-detective"><legend>1. Resultado comum dos dígitos</legend><div class="learn-puzzle-chips">${Array.from({ length: 10 }, (_, n) => button(`t:${n}`, n, answer.includes(`t:${n}`))).join("")}</div></fieldset><fieldset class="learn-detective"><legend>2. Representantes que faltam</legend><p>Considere a soma ou a diferença dos dois dígitos. As pistas já estão fora desta lista.</p><div class="learn-puzzle-chips">${Array.from(
            { length: 27 },
            (_, i) => i + 10,
          )
            .filter((n) => !q.shown.includes(n))
            .map((n) => button(`n:${n}`, n, answer.includes(`n:${n}`)))
            .join("")}</div></fieldset>`;
        if (q.kind === "cavalo")
          host.innerHTML = `<div class="learn-race-queue" aria-label="Fila de classificação">${q.shown.map((n, i) => `<span class="${i < answer.length ? "is-done" : i === answer.length ? "is-current" : ""}">${n}<small>${i < answer.length ? (answer[i] === "-1" ? "Fora" : `C${Number(answer[i]) + 1}`) : i === answer.length ? "Agora" : ""}</small></span>`).join("")}</div><p class="learn-puzzle-instruction" role="status">${answer.length < q.shown.length ? `Para onde vai o número ${q.shown[answer.length]}?` : "Fila completa. Confira sua classificação."}</p><div class="learn-horse-lanes">${[
            ["0", "Cavalo 1 · 1, 4, 7"],
            ["1", "Cavalo 2 · 2, 5, 8"],
            ["2", "Cavalo 3 · 3, 6, 9"],
            ["-1", "Fora das famílias · terminal 0"],
          ]
            .map(
              ([v, label]) =>
                `<div class="learn-horse-lane">${button(v, label, false, answer.length === q.shown.length ? "disabled" : "")}<div class="learn-horse-track" aria-hidden="true"><span style="left:${Math.min(85, (answer.filter((x) => x === v).length / q.shown.length) * 100)}%">♞</span></div></div>`,
            )
            .join("")}</div>`;
        if (q.kind === "eclipse")
          host.innerHTML = `<div class="learn-memory-sequence" ${observing || checked ? "" : "hidden"} aria-label="Sequência para observar">${q.shown.map((n) => `<span>${n}</span>`).join("")}</div><button type="button" class="learn-button learn-button-quiet" data-observe ${checked ? "hidden" : ""}>${observing ? "Pronto, reconstruir sequência" : "Observar novamente"}</button><div class="learn-orbit-pad">${q.orbit.map((n) => button(n, n, false, observing && !checked ? "disabled" : "")).join("")}</div><div class="learn-memory-answer" aria-label="Sua sequência" role="status">${answer.length ? answer.map((n, i) => `<span><small>${i + 1}</small>${n}</span>`).join("") : "Sua sequência aparecerá aqui."}</div>`;
        if (["cavalo", "eclipse"].includes(q.kind))
          host.insertAdjacentHTML(
            "beforeend",
            `<button type="button" class="learn-button learn-button-quiet" data-undo ${checked || !answer.length ? "disabled" : ""}>← Desfazer última escolha</button>`,
          );
      }
      host.onclick = (event) => {
        if (checked) return;
        const b = event.target.closest("button");
        if (!b || b.disabled) return;
        if (b.hasAttribute("data-observe")) {
          observing = !observing;
          draw();
          return;
        }
        if (b.hasAttribute("data-undo")) {
          answer.pop();
        } else if (b.hasAttribute("data-value")) {
          const v = b.dataset.value;
          if (q.kind === "gemeos") answer = [v];
          if (q.kind === "espelhos") {
            if (b.dataset.side === "left") {
              source = Number(v);
              draw();
              return;
            }
            if (source === null) return;
            answer = answer.filter(
              (x) => !x.startsWith(source + ":") && !x.endsWith(":" + v),
            );
            answer.push(`${source}:${v}`);
            source = null;
          }
          if (q.kind === "magneto" || q.kind === "camaleoes") {
            if (v.startsWith("t:"))
              answer = answer.filter((x) => !x.startsWith("t:"));
            answer = answer.includes(v)
              ? answer.filter((x) => x !== v)
              : [...answer, v];
          }
          if (q.kind === "cavalo" && answer.length < q.shown.length)
            answer.push(v);
          if (q.kind === "eclipse" && answer.length < 12) answer.push(v);
        } else return;
        onChange([...answer]);
        draw();
        const next = host.querySelector(
          `[data-value="${CSS.escape(b.dataset.value || "")}"]`,
        );
        if (next && !next.disabled) next.focus({ preventScroll: true });
      };
      host.oninput = (event) => {
        if (checked) return;
        const input = event.target;
        if (input.hasAttribute("data-answer-index")) {
          while (answer.length < 4) answer.push("");
          answer[Number(input.dataset.answerIndex)] = input.value.slice(0, 16);
          onChange([...answer]);
        }
        if (input.hasAttribute("data-outside")) {
          while (answer.length < 4) answer.push("");
          answer[Number(input.dataset.outside)] = input.checked ? "fora" : "";
          onChange([...answer]);
          draw();
        }
      };
      draw();
    },
  };
})();
