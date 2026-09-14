// Mantém os nove endereços existentes com a mesma estrutura e recursos.
const fs = require("node:fs");
const path = require("node:path");
const pages = [
  ["", "Estudo"],
  ["gemeos", "Gêmeos"],
  ["espelhos", "Espelhos"],
  ["fibonacci", "Fibonacci"],
  ["magneto", "Magneto"],
  ["camaleoes", "Camaleões"],
  ["triangulacao", "Pitágoras"],
  ["cavalos", "Cavalo"],
  ["eclipse-zero", "Eclipse Zero"],
];
const nav = [
  ["Dashboard", "dashboard", "home"],
  ["Estudo", "estudo", "book"],
  ["Módulos", "modulos", "layers"],
  
  ["Anotações", "notas", "note"],
  ["Favoritos", "favoritos", "star"],
  ["Roleta Operacional", "roleta", "roulette"],
  ["Roleta Real", "roleta-real", "roulette"],
  ["Provas", "provas", "exam"],
  ["Gestão", "gestao", "activity"],
];
const icon = (name) =>
  `<svg aria-hidden="true"><use href="/assets/dashboard-icons.svg#i-${name}"></use></svg>`;
for (const [route, name] of pages) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0b0b11">
  <meta name="robots" content="noindex,nofollow">
  <title>${name} | ${route ? "Estudo | " : ""}Turma do Primo</title>
  <link rel="icon" type="image/svg+xml" href="/assets/turma-primo-logo.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet">
  <script src="/study-appearance.js?v=20260913-1"></script>
  <link rel="stylesheet" href="/study-workspace.css?v=20260913-1">
  <script defer src="/study-curriculum.js?v=20260913-1"></script>
  <script defer src="/study-board.js?v=20260914-1"></script>
  <link rel="stylesheet" href="/study-board.css?v=20260914-1">
  <script defer src="/study-guides.js?v=20260914-1"></script>
  <script defer src="/study-games.js?v=20260913-2"></script>
  <script defer src="/study-state-model.js?v=20260913-2"></script>
  <script defer src="/study-sync.js?v=20260913-2"></script>
  <script defer src="/study-game-ui.js?v=20260913-2"></script>
  <script defer src="/study-workspace.js?v=20260913-2"></script>
  <link rel="stylesheet" href="/study-focus.css?v=20260913-2">
  <script defer src="/study-focus.js?v=20260913-2"></script>
</head>
<body class="learn-page" data-study-route="${route}">
  <a class="learn-skip" href="#studyMain">Pular para o conteúdo</a>
  <div class="learn-backdrop" id="studyBackdrop" hidden></div>
  <aside class="learn-sidebar" id="studySidebar" aria-label="Menu principal">
    <a class="learn-brand" href="/dashboard"><img src="/assets/turma-primo-logo.svg" width="38" height="44" alt=""><span>TURMA DO<strong>PRIMO<span>·</span></strong></span></a>
    <button class="learn-close-menu" id="studyCloseMenu" type="button" aria-label="Fechar menu">×</button>
    <div class="learn-space">${icon("book")}<span>Espaço do aluno<small>Aprenda no seu ritmo</small></span></div>
    <p class="learn-nav-label">SEU APRENDIZADO</p>
    <nav class="learn-nav">${nav.map(([label, href, symbol]) => `<a href="/${href}"${href === "estudo" ? ' class="is-active" aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`).join("")}</nav>
    <div class="learn-sidebar-bottom"><a class="learn-support" href="/suporte">${icon("support")}<span>Precisa de uma ajuda?<small>Converse com o suporte</small></span>↗</a><button class="learn-logout" id="studyLogout" type="button">${icon("logout")}Sair da conta</button><small class="learn-signature">CONHECIMENTO EM MOVIMENTO</small></div>
  </aside>
  <div class="learn-page-shell" id="studyShell">
    <header class="learn-topbar">
      <button class="learn-icon-button learn-menu" id="studyMenu" type="button" aria-label="Abrir menu" aria-controls="studySidebar" aria-expanded="false">${icon("menu")}</button>
      <div class="learn-breadcrumb"><a href="/dashboard">Meu espaço</a><span>/</span><a href="/estudo">Estudo</a>${route ? `<span>/</span><strong>${name}</strong>` : ""}</div>
      <div class="learn-top-actions"><button class="learn-icon-button" id="studyTheme" type="button" aria-label="Ativar tema claro">${icon("moon")}</button><a class="learn-icon-button" href="/notificacoes" aria-label="Notificações">${icon("bell")}</a><a class="learn-account" href="/perfil"><span id="studyAvatar">P</span><span><strong id="studyName">Aluno</strong><small>Meu perfil</small></span></a></div>
    </header>
    <main class="learn-main" id="studyMain" tabindex="-1">
      <section class="learn-loading" id="studyLoading" aria-live="polite"><div class="learn-loading-icon">${icon("book")}</div><h1 id="studyLoadTitle">Preparando seus estudos</h1><p id="studyLoadMessage">Só um instante. Estamos carregando seu espaço.</p><button class="learn-button" id="studyRetry" type="button" hidden>Tentar novamente</button></section>
      <div id="studyApp" hidden></div>
      <p class="learn-storage-status" id="studyStorageStatus" role="status" hidden></p>
      <noscript>Ative o JavaScript para acessar as atividades interativas.</noscript>
    </main>
    <footer class="learn-footer"><span>Turma do Primo <b>·</b> Central de estudos</span><span>Aprenda. Pratique. Revise.</span></footer>
  </div>
  <nav class="learn-dock" id="studyDock" aria-label="Atalhos no celular">${[
    ["Início", "dashboard", "home"],
    ["Estudo", "estudo", "book"],
    
    ["Anotações", "notas", "note"],
  ]
    .map(
      ([label, href, symbol]) =>
        `<a href="/${href}"${href === "estudo" ? ' aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span></a>`,
    )
    .join("")}</nav>
  <div class="learn-toast" id="studyToast" role="status" hidden></div>
</body>
</html>
`;
  fs.writeFileSync(
    path.join(
      __dirname,
      "..",
      "public",
      `estudo${route ? "-" + route : ""}.html`,
    ),
    html,
  );
}
console.log("Nove páginas de estudo atualizadas.");
