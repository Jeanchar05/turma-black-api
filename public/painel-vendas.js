/*==================================================
 TURMA DO PRIMO
 Painel Comercial
==================================================*/

"use strict";

/*==================================================
 CONFIG
==================================================*/

const API_URL = "https://turma-black-api-es3u.onrender.com";


const App = {

    usuario:null,

    vendas:[],

    vendedores:[],

    configuracoes:{},

    pagina:"dashboard"

};

/*==================================================
 UTIL
==================================================*/

const $ = e => document.querySelector(e);

const $$ = e => document.querySelectorAll(e);

/*==================================================
 MENU
==================================================*/

const sidebar = $("#sidebar");

const overlay = $("#sidebarOverlay");

$("#btnAbrirMenu")?.addEventListener("click",()=>{

    sidebar.classList.add("show");

    overlay.classList.add("show");

});

overlay?.addEventListener("click",()=>{

    sidebar.classList.remove("show");

    overlay.classList.remove("show");

});

/*==================================================
 PAGINAS
==================================================*/

function abrirPagina(id){

    App.pagina=id;

    $$(".pagina").forEach(p=>{

        p.classList.remove("active");

    });

    $$(".menu-btn").forEach(btn=>{

        btn.classList.remove("active");

    });

    $("#"+id)?.classList.add("active");

    document
    .querySelector(`[data-page="${id}"]`)
    ?.classList.add("active");

}

$$(".menu-btn").forEach(btn=>{

    btn.addEventListener("click",()=>{

        abrirPagina(btn.dataset.page);

    });

});

/*==================================================
 LOADING
==================================================*/

function loading(on=true){

    document.body.classList.toggle(

        "loading",

        on

    );

}

/*==================================================
 TOAST
==================================================*/

function toast(msg){

    const t=$("#toast");

    $("#toastTexto").textContent=msg;

    t.classList.add("show");

    setTimeout(()=>{

        t.classList.remove("show");

    },3000);

}

/*==================================================
 REQUISIÇÃO
==================================================*/

async function api(url,options={}){

    loading(true);

    try{

        const req=await fetch(

            API_URL+url,

            {

                headers:{

                    "Content-Type":"application/json"

                },

                ...options

            }

        );

        return await req.json();

    }

    catch(e){

        console.error(e);

        toast("Erro ao conectar.");

        return null;

    }

    finally{

        loading(false);

    }

}

/*==================================================
 USUARIO
==================================================*/

async function carregarUsuario(){

    try{

        const dados=await api("/me");

        if(!dados)return;

        App.usuario=dados;

        $("#nomeUsuario").textContent=dados.nome;

        $("#cargoUsuario").textContent=dados.cargo;

        $("#previewVendedor").textContent=dados.nome;

        $("#fotoUsuario").textContent=

        dados.nome

        .substring(0,2)

        .toUpperCase();

    }

    catch(e){

        console.error(e);

    }

}

/*==================================================
 DASHBOARD
==================================================*/

async function carregarDashboard(){

    const dados=await api("/dashboard");

    if(!dados)return;

    $("#totalAlunos").textContent=

    dados.totalAlunos;

    $("#valorHoje").textContent=

    "R$ "+dados.hoje;

    $("#valorMes").textContent=

    "R$ "+dados.mes;

    $("#rankingAtual").textContent=

    dados.posicao+"º";

    $("#valorComissao").textContent=

    "R$ "+dados.comissao;

    $("#metaPorcentagem").textContent=

    dados.meta+"%";

    $("#barraMeta").style.width=

    dados.meta+"%";

}

/*==================================================
 ULTIMAS VENDAS
==================================================*/

async function carregarUltimas(){

    const lista=

    await api("/vendas/ultimas");

    if(!lista)return;

    const div=$("#ultimasVendas");

    div.innerHTML="";

    lista.forEach(item=>{

        div.innerHTML+=`

        <div class="ultima-venda">

            <div>

                <strong>${item.nome}</strong>

                <small>${item.plano}</small>

            </div>

            <span>

            R$ ${item.valor}

            </span>

        </div>

        `;

    });

}

/*==================================================
 BOTÕES
==================================================*/

$("#btnAtualizar")?.addEventListener(

"click",

()=>{

carregarDashboard();

carregarUltimas();

toast("Atualizado.");

}

);

$("#btnDashboard")?.addEventListener(

"click",

()=>{

location.href="dashboard.html";

}

);

/*==================================================
 INIT
==================================================*/

document.addEventListener(

"DOMContentLoaded",

async()=>{

abrirPagina("dashboard");

await carregarUsuario();

await carregarDashboard();

await carregarUltimas();

});
/*==================================================
 CADASTRO DE VENDAS
==================================================*/

async function salvarVenda(){

    const venda={

        nome:$("#alunoNome").value.trim(),

        telefone:$("#alunoTelefone").value.trim(),

        cidade:$("#alunoCidade").value.trim(),

        estado:$("#alunoEstado").value.trim(),

        plano:$("#alunoPlano").value,

        valor:Number($("#alunoValor").value),

        pagamento:$("#formaPagamento").value,

        status:$("#statusVenda").value,

        observacoes:$("#observacoesAluno").value,

        vendedor:App.usuario.nome,

        data:new Date().toISOString()

    };

    if(!venda.nome){

        toast("Digite o nome do aluno.");

        return;

    }

    if(!venda.plano){

        toast("Selecione um plano.");

        return;

    }

    if(venda.valor<=0){

        toast("Valor inválido.");

        return;

    }

    const res=await api(

        "/vendas",

        {

            method:"POST",

            body:JSON.stringify(venda)

        }

    );

    if(!res)return;

    toast("Venda cadastrada!");

    limparFormulario();

    carregarHistorico();

    carregarDashboard();

    carregarUltimas();

}

/*==================================================
 LIMPAR
==================================================*/

function limparFormulario(){

    [

        "#alunoNome",

        "#alunoTelefone",

        "#alunoCidade",

        "#alunoEstado",

        "#alunoValor",

        "#observacoesAluno"

    ].forEach(c=>{

        $(c).value="";

    });

    $("#alunoPlano").selectedIndex=0;

    $("#formaPagamento").selectedIndex=0;

    $("#statusVenda").selectedIndex=0;

}

/*==================================================
 HISTÓRICO
==================================================*/

async function carregarHistorico(){

    const lista=await api("/vendas");

    if(!lista)return;

    App.vendas=lista;

    renderHistorico(lista);

}

/*==================================================
 RENDER
==================================================*/

function renderHistorico(lista){

    const tbody=$("#listaHistorico");

    tbody.innerHTML="";

    if(lista.length===0){

        tbody.innerHTML=`

        <tr>

            <td colspan="6">

                Nenhuma venda encontrada.

            </td>

        </tr>

        `;

        return;

    }

    lista.forEach(venda=>{

        tbody.innerHTML+=`

        <tr>

            <td>${venda.nome}</td>

            <td>${venda.plano}</td>

            <td>

                R$ ${Number(venda.valor).toFixed(2)}

            </td>

            <td>

                <span class="status ${venda.status}">

                    ${venda.status}

                </span>

            </td>

            <td>

                ${new Date(venda.data)

                .toLocaleDateString("pt-BR")}

            </td>

            <td>

                <button

                onclick="editarVenda('${venda.id}')">

                ✏

                </button>

                <button

                onclick="confirmarExcluir('${venda.id}')">

                🗑

                </button>

            </td>

        </tr>

        `;

    });

}

/*==================================================
 PESQUISA
==================================================*/

$("#pesquisaVenda")

?.addEventListener("keyup",e=>{

    const texto=

    e.target.value

    .toLowerCase()

    .trim();

    const resultado=

    App.vendas.filter(v=>{

        return(

            v.nome.toLowerCase()

            .includes(texto)

            ||

            v.plano.toLowerCase()

            .includes(texto)

            ||

            v.telefone

            .includes(texto)

        );

    });

    renderHistorico(resultado);

});

/*==================================================
 FILTRO
==================================================*/

$("#filtroStatus")

?.addEventListener("change",e=>{

    const status=e.target.value;

    if(status==="todos"){

        renderHistorico(App.vendas);

        return;

    }

    renderHistorico(

        App.vendas.filter(

            v=>v.status===status

        )

    );

});

/*==================================================
 PREVIEW
==================================================*/

$("#alunoPlano")

?.addEventListener("change",()=>{

    $("#previewPlano").textContent=

    $("#alunoPlano")

    .selectedOptions[0]

    .text;

});

$("#alunoValor")

?.addEventListener("keyup",()=>{

    $("#previewValor").textContent=

    "R$ "+(

        Number(

            $("#alunoValor").value

        )||0

    ).toFixed(2);

});

/*==================================================
 BOTÕES
==================================================*/

$("#btnSalvarVenda")

?.addEventListener(

"click",

salvarVenda

);

$("#btnLimparFormulario")

?.addEventListener(

"click",

limparFormulario

);

$("#btnCancelarCadastro")

?.addEventListener(

"click",

()=>{

limparFormulario();

abrirPagina("dashboard");

}

);

/*==================================================
 INICIALIZAÇÃO
==================================================*/

document.addEventListener(

"DOMContentLoaded",

()=>{

carregarHistorico();

});
/*==================================================
 RANKING
==================================================*/

async function carregarRanking(){

    const ranking = await api("/ranking");

    if(!ranking) return;

    App.vendedores = ranking;

    if(ranking[0]){

        $("#top1Nome").textContent = ranking[0].nome;
        $("#top1Valor").textContent = "R$ " + Number(ranking[0].total).toFixed(2);

    }

    if(ranking[1]){

        $("#top2Nome").textContent = ranking[1].nome;
        $("#top2Valor").textContent = "R$ " + Number(ranking[1].total).toFixed(2);

    }

    if(ranking[2]){

        $("#top3Nome").textContent = ranking[2].nome;
        $("#top3Valor").textContent = "R$ " + Number(ranking[2].total).toFixed(2);

    }

    renderRankingCompleto();

}

/*==================================================
 LISTA COMPLETA
==================================================*/

function renderRankingCompleto(){

    const div = $("#listaRankingCompleto");

    div.innerHTML = "";

    App.vendedores.forEach((vendedor,index)=>{

        div.innerHTML += `

        <div class="ranking-item">

            <div class="ranking-left">

                <strong>

                    ${index+1}º

                </strong>

                <div>

                    <h4>

                        ${vendedor.nome}

                    </h4>

                    <small>

                        ${vendedor.vendas} vendas

                    </small>

                </div>

            </div>

            <div class="ranking-right">

                <strong>

                    R$ ${Number(vendedor.total).toFixed(2)}

                </strong>

            </div>

        </div>

        `;

    });

}

/*==================================================
 RELATÓRIOS
==================================================*/

async function carregarRelatorios(){

    const dados = await api("/relatorios");

    if(!dados) return;

    $("#relatorioTotal").textContent =
    "R$ " + Number(dados.total).toFixed(2);

    $("#relatorioAlunos").textContent =
    dados.alunos;

    $("#relatorioMeta").textContent =
    dados.meta + "%";

    $("#relatorioMelhor").textContent =
    dados.melhor;

    criarGrafico(dados);

}

/*==================================================
 CHART
==================================================*/

let grafico = null;

function criarGrafico(dados){

    const canvas = $("#graficoVendas");

    if(!canvas) return;

    if(grafico){

        grafico.destroy();

    }

    grafico = new Chart(canvas,{

        type:"line",

        data:{

            labels:dados.labels,

            datasets:[{

                label:"Vendas",

                data:dados.valores,

                borderWidth:3,

                tension:.4,

                fill:true

            }]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false

        }

    });

}

/*==================================================
 EXPORTAR CSV
==================================================*/

function exportarCSV(){

    if(App.vendas.length===0){

        toast("Nenhuma venda.");

        return;

    }

    let csv="Aluno,Plano,Valor,Status,Data\n";

    App.vendas.forEach(v=>{

        csv+=`${v.nome},${v.plano},${v.valor},${v.status},${v.data}\n`;

    });

    const blob=new Blob(

        [csv],

        {

            type:"text/csv"

        }

    );

    const url=

    URL.createObjectURL(blob);

    const a=document.createElement("a");

    a.href=url;

    a.download="relatorio.csv";

    a.click();

    URL.revokeObjectURL(url);

}

/*==================================================
 CONFIGURAÇÕES
==================================================*/

async function salvarConfiguracoes(){

    const dados={

        meta:Number(

            $("#metaMensal").value

        ),

        comissao:Number(

            $("#comissao").value

        ),

        bonus:Number(

            $("#bonus").value

        )

    };

    const ok=await api(

        "/configuracoes",

        {

            method:"POST",

            body:JSON.stringify(dados)

        }

    );

    if(ok){

        toast("Configurações salvas.");

    }

}

/*==================================================
 BOTÕES
==================================================*/

$("#btnSalvarConfig")

?.addEventListener(

"click",

salvarConfiguracoes

);

$("#btnExportarCSV")

?.addEventListener(

"click",

exportarCSV

);

$("#btnExportarRelatorio")

?.addEventListener(

"click",

exportarCSV

);

$("#btnAtualizarRanking")

?.addEventListener(

"click",

()=>{

carregarRanking();

toast("Ranking atualizado.");

}

);

/*==================================================
 AUTO UPDATE
==================================================*/

setInterval(()=>{

    carregarDashboard();

    carregarRanking();

},30000);

/*==================================================
 INICIAR
==================================================*/

document.addEventListener(

"DOMContentLoaded",

()=>{

    carregarRanking();

    carregarRelatorios();

});

/*==================================================
 EDITAR VENDA
==================================================*/

let vendaSelecionada = null;

async function editarVenda(id){

    const venda = App.vendas.find(v=>v.id==id);

    if(!venda) return;

    vendaSelecionada=id;

    $("#editarNome").value=venda.nome;
    $("#editarTelefone").value=venda.telefone;
    $("#editarCidade").value=venda.cidade;
    $("#editarValor").value=venda.valor;

    $("#modalEditar").classList.add("show");

}

/*==================================================
 SALVAR EDIÇÃO
==================================================*/

async function salvarEdicao(){

    if(!vendaSelecionada)return;

    const dados={

        nome:$("#editarNome").value.trim(),

        telefone:$("#editarTelefone").value.trim(),

        cidade:$("#editarCidade").value.trim(),

        valor:Number($("#editarValor").value)

    };

    const ok=await api(

        "/vendas/"+vendaSelecionada,

        {

            method:"PUT",

            body:JSON.stringify(dados)

        }

    );

    if(!ok)return;

    toast("Venda atualizada.");

    fecharModalEditar();

    carregarHistorico();

    carregarDashboard();

    carregarRanking();

}

/*==================================================
 MODAL EDITAR
==================================================*/

function fecharModalEditar(){

    vendaSelecionada=null;

    $("#modalEditar").classList.remove("show");

}

/*==================================================
 EXCLUIR
==================================================*/

let vendaExcluir=null;

function confirmarExcluir(id){

    vendaExcluir=id;

    $("#modalExcluir").classList.add("show");

}

async function excluirVenda(){

    if(!vendaExcluir)return;

    const ok=await api(

        "/vendas/"+vendaExcluir,

        {

            method:"DELETE"

        }

    );

    if(!ok)return;

    toast("Venda removida.");

    fecharModalExcluir();

    carregarHistorico();

    carregarDashboard();

    carregarRanking();

}

/*==================================================
 MODAL EXCLUIR
==================================================*/

function fecharModalExcluir(){

    vendaExcluir=null;

    $("#modalExcluir").classList.remove("show");

}

/*==================================================
 ANIMAÇÕES
==================================================*/

function animarCards(){

    document.querySelectorAll(

        ".card,.card-stat,.ranking-card"

    ).forEach((card,index)=>{

        card.animate([

            {

                opacity:0,

                transform:"translateY(30px)"

            },

            {

                opacity:1,

                transform:"translateY(0)"

            }

        ],{

            duration:500,

            delay:index*70,

            fill:"forwards"

        });

    });

}

/*==================================================
 PERMISSÕES
==================================================*/

function aplicarPermissoes(){

    if(!App.usuario)return;

    const cargo=

    (App.usuario.cargo||"").toLowerCase();

    document

    .querySelectorAll("[data-cargo]")

    .forEach(el=>{

        const permitido=

        el.dataset.cargo

        .split(",")

        .map(v=>v.trim());

        if(

            !permitido.includes(cargo)

        ){

            el.remove();

        }

    });

}

/*==================================================
 SINCRONIZAÇÃO
==================================================*/

async function sincronizar(){

    await carregarDashboard();

    await carregarHistorico();

    await carregarRanking();

    await carregarRelatorios();

}

/*==================================================
 EVENTOS
==================================================*/

$("#btnSalvarEditar")

?.addEventListener(

"click",

salvarEdicao

);

$("#btnCancelarEditar")

?.addEventListener(

"click",

fecharModalEditar

);

$("#btnConfirmarExcluir")

?.addEventListener(

"click",

excluirVenda

);

$("#btnCancelarExcluir")

?.addEventListener(

"click",

fecharModalExcluir

);

/*==================================================
 ATALHOS
==================================================*/

window.addEventListener(

"keydown",

e=>{

    if(e.key==="Escape"){

        fecharModalEditar();

        fecharModalExcluir();

    }

});

/*==================================================
 AUTO UPDATE
==================================================*/

setInterval(async()=>{

    await sincronizar();

},60000);

/*==================================================
 INICIALIZAÇÃO FINAL
==================================================*/

document.addEventListener(

"DOMContentLoaded",

async()=>{

    await carregarUsuario();

    await sincronizar();

    aplicarPermissoes();

    animarCards();

    toast("Painel Comercial carregado.");

});