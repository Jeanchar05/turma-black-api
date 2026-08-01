"use strict";
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TRIANGLES = [
    { name: "Sequência", points: [3, 6, 9] },
    { name: "Equilíbrio", points: [4, 8, 12] },
    { name: "Progressão", points: [5, 10, 15] },
    { name: "Conexão", points: [1, 2, 5] },
    { name: "Distância", points: [3, 5, 34] },
    { name: "Race", points: [7, 24, 25] }
  ];

  let demoIndex = 0;
  let game = null;
  let selected = null;
  let streak = 0;
  let score = 0;

  async function loadHero() {
    const image = $("#triHero");
    if (!image) return;
    image.removeAttribute("src");
    image.style.opacity = "0";
    try {
      const response = await fetch(`/assets/study/pitagoras-module-approved.base64?v=20260801-pitagoras-final-1&t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) throw new Error("asset indisponível");
      const base64 = (await response.text()).trim();
      if (base64.startsWith("/9j/")) image.src = `data:image/jpeg;base64,${base64}`;
      else if (base64.startsWith("UklG")) image.src = `data:image/webp;base64,${base64}`;
      else if (base64.startsWith("iVBOR")) image.src = `data:image/png;base64,${base64}`;
      else throw new Error("formato inválido");
      image.onload = () => { image.style.opacity = "1"; };
    } catch (error) {
      console.warn("Arte oficial do Pitágoras indisponível", error);
      image.style.opacity = "0";
    }
  }

  function tabs() {
    $$("[data-panel]").forEach(button => {
      button.onclick = () => {
        $$("[data-panel]").forEach(item => item.classList.remove("active"));
        $$(".panel").forEach(item => item.classList.remove("active"));
        button.classList.add("active");
        $("#" + button.dataset.panel)?.classList.add("active");
      };
    });
  }

  function mount(id, clickable = false) {
    const root = $(id);
    window.StudyRacePremium?.mount(root);
    if (clickable) {
      $$("button[data-n]", root).forEach(button => {
        button.onclick = () => {
          selected = +button.dataset.n;
          $$("button[data-n]", root).forEach(item => item.classList.toggle("game-selected", item === button));
        };
      });
    }
    return root;
  }

  function clear(root) {
    $$("button[data-n]", root).forEach(button => button.classList.remove("target", "protect", "extra", "mark-target", "mark-protect", "game-selected", "answer-correct", "answer-wrong", "answer-missed"));
  }

  function mark(root, points, classes = ["protect", "protect", "target"]) {
    clear(root);
    points.forEach((number, index) => root.querySelector(`[data-n="${number}"]`)?.classList.add(classes[index] || "target"));
  }

  function renderDemo() {
    const triangle = TRIANGLES[demoIndex % TRIANGLES.length];
    demoIndex++;
    $("#triDemoName").textContent = triangle.name;
    $("#triDemoPoints").textContent = triangle.points.join(" · ");
    $("#triDemoRule").textContent = `Os pontos ${triangle.points[0]} e ${triangle.points[1]} encontram equilíbrio quando o terceiro vértice fecha em ${triangle.points[2]}.`;
    mark($("#triRace"), triangle.points, ["protect", "protect", "target"]);
    $("#triDemoCount").textContent = String(demoIndex);
  }

  function renderExamples() {
    const root = $("#triExamples");
    root.innerHTML = TRIANGLES.slice(0, 3).map(triangle => `
      <article class="tri-example-card">
        <div class="tri-points">${triangle.points.map(number => `<span>${number}</span>`).join("")}</div>
        <b>Triângulo ${triangle.name}</b>
        <small>${triangle.points.join(" – ")} · observe como os três vértices trabalham como uma única região.</small>
      </article>`).join("");
  }

  function newGame() {
    const triangle = TRIANGLES[Math.floor(Math.random() * TRIANGLES.length)];
    const missing = Math.floor(Math.random() * 3);
    const shown = triangle.points.filter((_, index) => index !== missing);
    game = { ...triangle, missing, answer: triangle.points[missing], shown };
    selected = null;
    $("#gameA").textContent = shown[0];
    $("#gameB").textContent = shown[1];
    $("#gameFeedback").className = "feedback";
    $("#gameFeedback").textContent = "Marque na Race o número que fecha o terceiro vértice.";
    mark($("#gameRace"), shown, ["protect", "protect"]);
    $$("button[data-n]", $("#gameRace")).forEach(item => item.classList.remove("game-selected", "answer-correct", "answer-wrong", "answer-missed"));
  }

  function checkGame() {
    if (selected === null) {
      $("#gameFeedback").className = "feedback bad";
      $("#gameFeedback").textContent = "Escolha um número na Race antes de confirmar.";
      return;
    }
    const root = $("#gameRace");
    const answer = game.answer;
    $$("button[data-n]", root).forEach(button => {
      const number = +button.dataset.n;
      if (number === answer) button.classList.add(selected === answer ? "answer-correct" : "answer-missed");
      else if (number === selected) button.classList.add("answer-wrong");
    });
    if (selected === answer) {
      streak++;
      score += 100;
      $("#gameFeedback").className = "feedback ok";
      $("#gameFeedback").textContent = `Perfeito! ${game.shown.join(" e ")} fecham com ${answer} no triângulo ${game.name}.`;
    } else {
      streak = 0;
      $("#gameFeedback").className = "feedback bad";
      $("#gameFeedback").textContent = `O ponto correto era ${answer}. Observe a família ${game.points.join(" – ")}.`;
    }
    $("#gameStreak").textContent = streak;
    $("#gameScore").textContent = score;
  }

  function init() {
    loadHero();
    tabs();
    renderExamples();
    mount("#triRace");
    mount("#gameRace", true);
    $("#triRandom").onclick = renderDemo;
    $("#triNext").onclick = renderDemo;
    $("#gameConfirm").onclick = checkGame;
    $("#gameNext").onclick = newGame;
    $("#studyMenuToggle")?.addEventListener("click", () => $("#studySidebar")?.classList.add("open"));
    renderDemo();
    newGame();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();