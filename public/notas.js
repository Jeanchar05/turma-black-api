// ======================================
// NOTAS.JS — TURMA BLACK
// Anotações online + tema global claro/escuro
// ======================================

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const API_URL = "https://turma-black-api-es3u.onrender.com";

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  // ======================================
  // AUTH
  // ======================================

  let usuario = null;

  try {
    usuario = JSON.parse(localStorage.getItem("usuarioLogado") || "null");
  } catch {
    usuario = null;
  }

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken");

  if (!usuario || !token) {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("token");
    window.location.href = "index.html";
    return;
  }

  // ======================================
  // ESTADO
  // ======================================

  let notas = [];
  let notaParaExcluir = null;
  let carregando = false;

  // ======================================
  // HELPERS
  // ======================================

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? "";
  }

  function getValue(id) {
    return $(id)?.value || "";
  }

  function escapeHTML(texto) {
    return String(texto || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function idNota(nota) {
    return nota.id || nota._id || nota.notaId;
  }

  function normalizarNota(nota) {
    return {
      ...nota,
      id: nota.id || nota._id || nota.notaId,
      titulo: nota.titulo || "",
      categoria: nota.categoria || "Geral",
      conteudo: nota.conteudo || nota.texto || "",
      importante: Boolean(nota.importante),
      criadoEm: nota.criadoEm || nota.createdAt || nota.dataCriacao,
      atualizadoEm: nota.atualizadoEm || nota.updatedAt || nota.dataAtualizacao,
      data: nota.data || nota.criadoEm || nota.createdAt || new Date().toISOString(),
    };
  }

  function formatarData(data) {
    if (!data) return "Sem data";

    try {
      return new Date(data).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return String(data);
    }
  }

  function desativarBotao(id, estado = true, texto = null) {
    const btn = $(id);
    if (!btn) return;

    btn.disabled = estado;
    btn.classList.toggle("is-loading", estado);

    if (texto) {
      if (!btn.dataset.originalText) {
        btn.dataset.originalText = btn.textContent;
      }

      btn.textContent = estado ? texto : btn.dataset.originalText;
    }
  }

  function mostrarLoading(estado) {
    carregando = estado;

    const loading = $("notasLoading");
    if (loading) loading.style.display = estado ? "flex" : "none";

    setText("statusSyncNotas", estado ? "..." : "ON");
    setText("statusSyncTexto", estado ? "Sincronizando..." : "Conectado ao servidor");

    const badge = $("notasStorageBadge");
    if (badge) {
      badge.textContent = estado ? "☁️ Sincronizando..." : "☁️ Salvamento online";
    }
  }

  function mostrarToast(texto, tipo = "sucesso") {
    const toast = $("notasToast");
    const icon = $("notasToastIcon");
    const msg = $("notasToastTexto");

    if (!toast || !msg) {
      alert(texto);
      return;
    }

    const icones = {
      sucesso: "✅",
      erro: "❌",
      info: "ℹ️",
      aviso: "⚠️",
    };

    toast.className = `notas-toast active ${tipo}`;
    if (icon) icon.textContent = icones[tipo] || "✅";
    msg.textContent = texto;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove("active");
    }, 3200);
  }

  function registrarAtividade(atividade) {
    try {
      const atividades = JSON.parse(localStorage.getItem("atividadesRecentes") || "[]");

      atividades.unshift({
        ...atividade,
        data: new Date().toISOString(),
      });

      localStorage.setItem(
        "atividadesRecentes",
        JSON.stringify(atividades.slice(0, 30))
      );
    } catch {}
  }

  // ======================================
  // TEMA GLOBAL
  // ======================================

  const TEMA_KEY = "temaSite";

  function atualizarBotaoTema(tema) {
    const btn = $("btnTemaNotas");
    const texto = $("temaTexto");

    if (!btn) return;

    const claro = tema === "claro";

    btn.classList.toggle("is-light", claro);
    btn.classList.toggle("is-dark", !claro);
    btn.setAttribute("aria-pressed", claro ? "true" : "false");

    if (texto) texto.textContent = claro ? "Claro" : "Escuro";
  }

  function aplicarTema(tema, animar = false) {
    const temaFinal = tema === "claro" ? "claro" : "escuro";

    document.documentElement.dataset.theme = temaFinal;
    document.body.dataset.theme = temaFinal;

    document.documentElement.classList.toggle("tema-claro", temaFinal === "claro");
    document.documentElement.classList.toggle("tema-escuro", temaFinal !== "claro");

    document.body.classList.toggle("tema-claro", temaFinal === "claro");
    document.body.classList.toggle("tema-escuro", temaFinal !== "claro");

    localStorage.setItem(TEMA_KEY, temaFinal);
    atualizarBotaoTema(temaFinal);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", temaFinal === "claro" ? "#e8e5ef" : "#0b0614");
    }

    if (animar) {
      document.body.classList.add("theme-changing");

      clearTimeout(document.body._themeTimer);
      document.body._themeTimer = setTimeout(() => {
        document.body.classList.remove("theme-changing");
      }, 500);
    }
  }

  function alternarTema() {
    const atual = localStorage.getItem(TEMA_KEY) || "escuro";
    const proximo = atual === "claro" ? "escuro" : "claro";

    aplicarTema(proximo, true);

    registrarAtividade({
      icone: proximo === "claro" ? "☀️" : "🌙",
      titulo: "Tema alterado",
      descricao: proximo === "claro" ? "Tema claro ativado." : "Tema escuro ativado.",
    });
  }

  aplicarTema(localStorage.getItem(TEMA_KEY) || "escuro", false);
  $("btnTemaNotas")?.addEventListener("click", alternarTema);

  // ======================================
  // API ONLINE
  // ======================================

  async function chamarAPI(rotas, metodo = "GET", body = null) {
    const listaRotas = Array.isArray(rotas) ? rotas : [rotas];

    let ultimoErro = null;

    for (const rota of listaRotas) {
      try {
        const config = {
          method: metodo,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        };

        if (body !== null && body !== undefined) {
          config.body = JSON.stringify(body);
        }

        const resposta = await fetch(`${API_URL}${rota}`, config);
        const json = await resposta.json().catch(() => ({}));

        if (resposta.status === 401 || resposta.status === 403) {
          localStorage.removeItem("usuarioLogado");
          localStorage.removeItem("token");
          window.location.href = "index.html";
          return null;
        }

        if (resposta.status === 404) {
          ultimoErro = new Error(`Rota não encontrada: ${rota}`);
          continue;
        }

        if (!resposta.ok) {
          throw new Error(
            json.erro ||
            json.mensagem ||
            json.message ||
            `Erro na API (${resposta.status})`
          );
        }

        return json;
      } catch (error) {
        ultimoErro = error;

        if (!String(error.message || "").includes("Rota não encontrada")) {
          throw error;
        }
      }
    }

    throw ultimoErro || new Error("Não foi possível conectar ao servidor.");
  }

  async function carregarNotasOnline() {
    try {
      mostrarLoading(true);

      const dados = await chamarAPI(["/notas", "/api/notas"], "GET");

      const lista =
        dados?.notas ||
        dados?.anotacoes ||
        dados?.items ||
        dados?.data ||
        [];

      notas = Array.isArray(lista) ? lista.map(normalizarNota) : [];

      renderizarNotas();

      setText("statusSyncNotas", "ON");
      setText("statusSyncTexto", "Sincronizado");
    } catch (error) {
      console.error(error);

      notas = [];
      renderizarNotas();

      setText("statusSyncNotas", "OFF");
      setText("statusSyncTexto", "Erro ao conectar");

      mostrarToast(
        "Não consegui carregar as anotações online. Verifique as rotas do backend.",
        "erro"
      );
    } finally {
      mostrarLoading(false);
    }
  }

  async function criarNotaOnline(body) {
    const dados = await chamarAPI(["/notas", "/api/notas"], "POST", body);
    return normalizarNota(dados?.nota || dados?.anotacao || dados?.data || dados || body);
  }

  async function atualizarNotaOnline(id, body) {
    const dados = await chamarAPI(
      [`/notas/${id}`, `/api/notas/${id}`],
      "PUT",
      body
    );

    return normalizarNota(dados?.nota || dados?.anotacao || dados?.data || dados || {
      ...body,
      id,
    });
  }

  async function excluirNotaOnline(id) {
    await chamarAPI([`/notas/${id}`, `/api/notas/${id}`], "DELETE");
  }

  async function limparTodasOnline() {
    await chamarAPI(["/notas", "/api/notas"], "DELETE");
  }

  // ======================================
  // MENU / NAVEGAÇÃO
  // ======================================

  function abrirMenu() {
    $("sidebar")?.classList.add("active");
    $("sidebarOverlay")?.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function fecharMenu() {
    $("sidebar")?.classList.remove("active");
    $("sidebarOverlay")?.classList.remove("active");
    document.body.style.overflow = "";
  }

  $$("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      if (page) window.location.href = page;
    });
  });

  $("btnMenu")?.addEventListener("click", () => {
    $("sidebar")?.classList.contains("active") ? fecharMenu() : abrirMenu();
  });

  $("sidebarOverlay")?.addEventListener("click", fecharMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      fecharMenu();
      fecharModais();
    }
  });

  $("btnSair")?.addEventListener("click", () => {
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("token");
    window.location.href = "index.html";
  });

  // ======================================
  // CONTADORES
  // ======================================

  function contarCategoria(categoria) {
    return notas.filter((nota) => nota.categoria === categoria).length;
  }

  function atualizarContadores() {
    const total = notas.length;
    const importantes = notas.filter((nota) => nota.importante).length;

    setText("totalNotas", total);
    setText("notasFavoritas", `${importantes} importantes`);
    setText("totalImportantes", importantes);

    setText("statEstudo", contarCategoria("Estudo"));
    setText("statEstrategia", contarCategoria("Estratégia"));
    setText("statProva", contarCategoria("Prova"));
    setText("statBanca", contarCategoria("Banca"));
    setText("statGeral", contarCategoria("Geral"));
  }

  // ======================================
  // RENDER
  // ======================================

  function categoriaIcone(categoria) {
    const mapa = {
      Estudo: "📚",
      Estratégia: "🎯",
      Prova: "📝",
      Banca: "💰",
      Geral: "📌",
    };

    return mapa[categoria] || "📌";
  }

  function renderizarNotas() {
    const lista = $("listaNotas");
    if (!lista) return;

    const busca = getValue("buscarNota").toLowerCase().trim();
    const categoria = getValue("filtroCategoria") || "Todas";
    const somenteImportantes = $("filtroImportantes")?.checked || false;

    const notasFiltradas = notas.filter((nota) => {
      const texto = `${nota.titulo} ${nota.conteudo} ${nota.categoria}`.toLowerCase();

      const bateBusca = texto.includes(busca);
      const bateCategoria = categoria === "Todas" || nota.categoria === categoria;
      const bateImportante = !somenteImportantes || nota.importante;

      return bateBusca && bateCategoria && bateImportante;
    });

    atualizarContadores();

    if (carregando) return;

    if (!notasFiltradas.length) {
      lista.innerHTML = `
        <div class="empty-notas">
          <span>🧾</span>
          <h3>Nenhuma anotação encontrada</h3>
          <p>Crie uma nova anotação ou ajuste os filtros de busca.</p>
        </div>
      `;
      return;
    }

    lista.innerHTML = notasFiltradas
      .map((nota) => {
        const id = escapeHTML(idNota(nota));
        const data = nota.atualizadoEm || nota.criadoEm || nota.data;

        return `
          <article class="nota-card ${nota.importante ? "importante" : ""}">
            <div class="nota-card-glow"></div>

            <div class="nota-top">
              <div>
                <span class="nota-categoria">
                  ${categoriaIcone(nota.categoria)} ${escapeHTML(nota.categoria)}
                </span>

                <h3>${escapeHTML(nota.titulo)}</h3>
              </div>

              ${nota.importante ? `<span class="nota-star" title="Importante">⭐</span>` : ""}
            </div>

            <p class="nota-conteudo">
              ${escapeHTML(nota.conteudo)}
            </p>

            <div class="nota-data">
              ${nota.atualizadoEm ? "Atualizada em" : "Criada em"} ${escapeHTML(formatarData(data))}
            </div>

            <div class="nota-actions">
              <button class="btn-editar-nota" data-editar="${id}">
                ✏️ Editar
              </button>

              <button class="btn-excluir-nota" data-excluir="${id}">
                🗑️ Excluir
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    ativarBotoesNotas();
  }

  function ativarBotoesNotas() {
    $$("[data-editar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editarNota(btn.dataset.editar);
      });
    });

    $$("[data-excluir]").forEach((btn) => {
      btn.addEventListener("click", () => {
        notaParaExcluir = btn.dataset.excluir;
        abrirModal("modalExcluirNota");
      });
    });
  }

  // ======================================
  // FORM
  // ======================================

  function limparFormulario() {
    $("formNota")?.reset();

    setValue("notaEditandoId", "");
    setText("btnSalvarNota", "💾 Salvar online");
    setText("contadorCaracteres", "0");

    const cancelar = $("btnCancelarEdicao");
    if (cancelar) cancelar.style.display = "none";
  }

  function editarNota(id) {
    const nota = notas.find((item) => String(idNota(item)) === String(id));
    if (!nota) return;

    setValue("notaEditandoId", idNota(nota));
    setValue("notaTitulo", nota.titulo);
    setValue("notaCategoria", nota.categoria);
    setValue("notaConteudo", nota.conteudo);

    if ($("notaImportante")) {
      $("notaImportante").checked = Boolean(nota.importante);
    }

    setText("btnSalvarNota", "💾 Atualizar online");

    const cancelar = $("btnCancelarEdicao");
    if (cancelar) cancelar.style.display = "inline-flex";

    atualizarContadorCaracteres();

    $("painelCriarNota")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    mostrarToast("Nota carregada para edição.", "info");
  }

  async function salvarNota(e) {
    e.preventDefault();

    const idEditando = getValue("notaEditandoId");

    const titulo = getValue("notaTitulo").trim();
    const categoria = getValue("notaCategoria");
    const conteudo = getValue("notaConteudo").trim();
    const importante = $("notaImportante")?.checked || false;

    if (!titulo || !categoria || !conteudo) {
      mostrarToast("Preencha todos os campos da anotação.", "aviso");
      return;
    }

    const body = {
      titulo,
      categoria,
      conteudo,
      importante,
      alunoEmail: usuario.email,
    };

    try {
      desativarBotao("btnSalvarNota", true, idEditando ? "Atualizando..." : "Salvando...");

      if (idEditando) {
        const notaAtualizada = await atualizarNotaOnline(idEditando, body);

        notas = notas.map((nota) =>
          String(idNota(nota)) === String(idEditando)
            ? normalizarNota({ ...nota, ...notaAtualizada, atualizadoEm: new Date().toISOString() })
            : nota
        );

        registrarAtividade({
          icone: "🧾",
          titulo: "Nota atualizada online",
          descricao: titulo,
        });

        mostrarToast("Anotação atualizada online.", "sucesso");
      } else {
        const novaNota = await criarNotaOnline(body);

        notas.unshift(
          normalizarNota({
            ...novaNota,
            criadoEm: novaNota.criadoEm || new Date().toISOString(),
          })
        );

        registrarAtividade({
          icone: "🧾",
          titulo: "Nova nota criada online",
          descricao: titulo,
        });

        mostrarToast("Anotação salva online.", "sucesso");
      }

      limparFormulario();
      renderizarNotas();
    } catch (error) {
      console.error(error);
      mostrarToast(error.message || "Erro ao salvar anotação online.", "erro");
    } finally {
      desativarBotao("btnSalvarNota", false);
    }
  }

  $("formNota")?.addEventListener("submit", salvarNota);

  $("btnCancelarEdicao")?.addEventListener("click", () => {
    limparFormulario();
    mostrarToast("Edição cancelada.", "info");
  });

  // ======================================
  // EXCLUIR
  // ======================================

  async function confirmarExcluirNota() {
    if (!notaParaExcluir) return;

    try {
      await excluirNotaOnline(notaParaExcluir);

      const notaRemovida = notas.find((nota) => String(idNota(nota)) === String(notaParaExcluir));

      notas = notas.filter((nota) => String(idNota(nota)) !== String(notaParaExcluir));

      registrarAtividade({
        icone: "🗑️",
        titulo: "Nota excluída online",
        descricao: notaRemovida?.titulo || "Uma anotação foi removida.",
      });

      notaParaExcluir = null;

      fecharModal("modalExcluirNota");
      renderizarNotas();

      mostrarToast("Anotação excluída online.", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast(error.message || "Erro ao excluir anotação.", "erro");
    }
  }

  $("btnConfirmarExcluirNota")?.addEventListener("click", confirmarExcluirNota);

  $("btnCancelarExcluirNota")?.addEventListener("click", () => {
    notaParaExcluir = null;
    fecharModal("modalExcluirNota");
  });

  // ======================================
  // LIMPAR TODAS
  // ======================================

  $("btnLimparNotas")?.addEventListener("click", () => {
    if (!notas.length) {
      mostrarToast("Você ainda não possui anotações.", "info");
      return;
    }

    abrirModal("modalConfirmar");
  });

  $("btnCancelarModal")?.addEventListener("click", () => {
    fecharModal("modalConfirmar");
  });

  $("btnConfirmarModal")?.addEventListener("click", async () => {
    try {
      await limparTodasOnline();

      notas = [];

      registrarAtividade({
        icone: "🧹",
        titulo: "Notas apagadas online",
        descricao: "Todas as anotações foram removidas da conta.",
      });

      limparFormulario();
      renderizarNotas();
      fecharModal("modalConfirmar");

      mostrarToast("Todas as anotações foram apagadas online.", "sucesso");
    } catch (error) {
      console.error(error);
      mostrarToast(error.message || "Erro ao apagar anotações.", "erro");
    }
  });

  // ======================================
  // FILTROS / BUSCA
  // ======================================

  $("buscarNota")?.addEventListener("input", renderizarNotas);
  $("filtroCategoria")?.addEventListener("change", renderizarNotas);
  $("filtroImportantes")?.addEventListener("change", renderizarNotas);

  $("btnLimparFiltros")?.addEventListener("click", () => {
    setValue("buscarNota", "");
    setValue("filtroCategoria", "Todas");

    if ($("filtroImportantes")) {
      $("filtroImportantes").checked = false;
    }

    renderizarNotas();
    mostrarToast("Filtros limpos.", "info");
  });

  $("btnRecarregarNotas")?.addEventListener("click", async () => {
    await carregarNotasOnline();
    mostrarToast("Anotações recarregadas do servidor.", "sucesso");
  });

  // ======================================
  // CONTADOR DE CARACTERES
  // ======================================

  function atualizarContadorCaracteres() {
    const texto = getValue("notaConteudo");
    setText("contadorCaracteres", texto.length);
  }

  $("notaConteudo")?.addEventListener("input", atualizarContadorCaracteres);

  // ======================================
  // BOTÕES HERO
  // ======================================

  $("btnFocarNota")?.addEventListener("click", () => {
    $("painelCriarNota")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setTimeout(() => $("notaTitulo")?.focus(), 350);
  });

  $("btnVerNotas")?.addEventListener("click", () => {
    $("secaoNotasSalvas")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });

  // ======================================
  // MODAIS
  // ======================================

  function abrirModal(id) {
    $(id)?.classList.add("active", "open");
  }

  function fecharModal(id) {
    $(id)?.classList.remove("active", "open");
  }

  function fecharModais() {
    ["modalConfirmar", "modalExcluirNota"].forEach(fecharModal);
  }

  $$(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active", "open");
      }
    });
  });

  // ======================================
  // INICIAR
  // ======================================

  atualizarContadorCaracteres();
  carregarNotasOnline();
});