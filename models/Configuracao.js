const mongoose = require("mongoose");

const planoSchema = new mongoose.Schema(
  {
    ativo: {
      type: Boolean,
      default: true
    },

    nome: {
      type: String,
      default: ""
    },

    descricao: {
      type: String,
      default: ""
    },

    valor: {
      type: Number,
      default: 0
    },

    dias: {
      type: Number,
      default: 30
    },

    destaque: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const permissaoSchema = new mongoose.Schema(
  {
    dashboard: {
      type: Boolean,
      default: true
    },

    painelAdmin: {
      type: Boolean,
      default: false
    },

    painelVendas: {
      type: Boolean,
      default: false
    },

    usuarios: {
      type: Boolean,
      default: false
    },

    aprovacoes: {
      type: Boolean,
      default: false
    },

    controleAlunos: {
      type: Boolean,
      default: false
    },

    relatorios: {
      type: Boolean,
      default: false
    },

    vendedores: {
      type: Boolean,
      default: false
    },

    agendaPrimo: {
      type: Boolean,
      default: false
    },

    notificacoes: {
      type: Boolean,
      default: false
    },

    controleAdmin: {
      type: Boolean,
      default: false
    },

    seguranca: {
      type: Boolean,
      default: false
    },

    planos: {
      type: Boolean,
      default: false
    },

    provas: {
      type: Boolean,
      default: false
    },

    suporte: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const configuracaoSchema = new mongoose.Schema(
  {
    chave: {
      type: String,
      unique: true,
      default: "sistema"
    },

    nomeSistema: {
      type: String,
      default: "Turma do Primo"
    },

    nomePremium: {
      type: String,
      default: "Turma Black"
    },

    versao: {
      type: String,
      default: "2.0.0"
    },

    ambiente: {
      type: String,
      enum: ["desenvolvimento", "producao", "manutencao"],
      default: "producao"
    },

    temaPadrao: {
      type: String,
      enum: ["dark", "light"],
      default: "dark"
    },

    modoManutencao: {
      type: Boolean,
      default: false
    },

    manutencaoTitulo: {
      type: String,
      default: "Site temporariamente off-line"
    },

    manutencaoMensagem: {
      type: String,
      default: "Estamos realizando atualizações. A Turma do Primo retornará em breve."
    },

    previsaoRetorno: {
      type: String,
      default: ""
    },

    comissaoPadrao: {
      type: Number,
      default: 20
    },

    moeda: {
      type: String,
      default: "BRL"
    },

    planos: {
      free: {
        type: planoSchema,
        default: () => ({
          ativo: true,
          nome: "Free",
          descricao: "Plano gratuito",
          valor: 0,
          dias: 0,
          destaque: false
        })
      },

      black30: {
        type: planoSchema,
        default: () => ({
          ativo: true,
          nome: "Black 30 dias",
          descricao: "Acesso premium por 30 dias",
          valor: 97,
          dias: 30,
          destaque: true
        })
      },

      black90: {
        type: planoSchema,
        default: () => ({
          ativo: true,
          nome: "Black 90 dias",
          descricao: "Acesso premium por 90 dias",
          valor: 197,
          dias: 90,
          destaque: false
        })
      },

      black180: {
        type: planoSchema,
        default: () => ({
          ativo: true,
          nome: "Black 180 dias",
          descricao: "Acesso premium por 180 dias",
          valor: 297,
          dias: 180,
          destaque: false
        })
      },

      black360: {
        type: planoSchema,
        default: () => ({
          ativo: true,
          nome: "Black 360 dias",
          descricao: "Acesso premium por 360 dias",
          valor: 497,
          dias: 360,
          destaque: false
        })
      },

      particular: {
        type: planoSchema,
        default: () => ({
          ativo: true,
          nome: "Mentoria Particular",
          descricao: "Plano particular/manual",
          valor: 0,
          dias: 30,
          destaque: false
        })
      }
    },

    vendas: {
      permitirVendaManual: {
        type: Boolean,
        default: true
      },

      criarAlunoAutomatico: {
        type: Boolean,
        default: true
      },

      aprovarAlunoAutomatico: {
        type: Boolean,
        default: true
      },

      statusPadraoVenda: {
        type: String,
        enum: ["pendente", "pago"],
        default: "pago"
      },

      comissaoFixa: {
        type: Boolean,
        default: true
      }
    },

    notificacoes: {
      ativas: {
        type: Boolean,
        default: true
      },

      mostrarSino: {
        type: Boolean,
        default: true
      },

      limitePorUsuario: {
        type: Number,
        default: 30
      },

      permitirFixadas: {
        type: Boolean,
        default: true
      }
    },

    seguranca: {
      bloquearBotaoDireito: {
        type: Boolean,
        default: true
      },

      bloquearAtalhos: {
        type: Boolean,
        default: true
      },

      bloquearInspecionar: {
        type: Boolean,
        default: true
      },

      bloquearPrint: {
        type: Boolean,
        default: true
      },

      marcaDagua: {
        type: Boolean,
        default: true
      },

      detectarDesktop: {
        type: Boolean,
        default: true
      }
    },

    permissoes: {
      superadmin: {
        type: permissaoSchema,
        default: () => ({
          dashboard: true,
          painelAdmin: true,
          painelVendas: true,
          usuarios: true,
          aprovacoes: true,
          controleAlunos: true,
          relatorios: true,
          vendedores: true,
          agendaPrimo: true,
          notificacoes: true,
          controleAdmin: true,
          seguranca: true,
          planos: true,
          provas: true,
          suporte: true
        })
      },

      admin: {
        type: permissaoSchema,
        default: () => ({
          dashboard: true,
          painelAdmin: true,
          painelVendas: true,
          usuarios: true,
          aprovacoes: true,
          controleAlunos: true,
          relatorios: false,
          vendedores: true,
          agendaPrimo: false,
          notificacoes: true,
          controleAdmin: false,
          seguranca: false,
          planos: true,
          provas: true,
          suporte: true
        })
      },

      moderador: {
        type: permissaoSchema,
        default: () => ({
          dashboard: true,
          painelAdmin: true,
          painelVendas: false,
          usuarios: true,
          aprovacoes: true,
          controleAlunos: false,
          relatorios: false,
          vendedores: false,
          agendaPrimo: false,
          notificacoes: false,
          controleAdmin: false,
          seguranca: false,
          planos: false,
          provas: true,
          suporte: true
        })
      },

      suporte: {
        type: permissaoSchema,
        default: () => ({
          dashboard: true,
          painelAdmin: true,
          painelVendas: true,
          usuarios: false,
          aprovacoes: false,
          controleAlunos: false,
          relatorios: false,
          vendedores: false,
          agendaPrimo: false,
          notificacoes: false,
          controleAdmin: false,
          seguranca: false,
          planos: false,
          provas: false,
          suporte: true
        })
      },

      vendedor: {
        type: permissaoSchema,
        default: () => ({
          dashboard: true,
          painelAdmin: false,
          painelVendas: true,
          usuarios: false,
          aprovacoes: false,
          controleAlunos: false,
          relatorios: false,
          vendedores: false,
          agendaPrimo: false,
          notificacoes: false,
          controleAdmin: false,
          seguranca: false,
          planos: false,
          provas: false,
          suporte: false
        })
      },

      aluno: {
        type: permissaoSchema,
        default: () => ({
          dashboard: true,
          painelAdmin: false,
          painelVendas: false,
          usuarios: false,
          aprovacoes: false,
          controleAlunos: false,
          relatorios: false,
          vendedores: false,
          agendaPrimo: false,
          notificacoes: false,
          controleAdmin: false,
          seguranca: false,
          planos: false,
          provas: false,
          suporte: true
        })
      }
    },

    links: {
      whatsappSuporte: {
        type: String,
        default: ""
      },

      whatsappVendas: {
        type: String,
        default: ""
      },

      instagram: {
        type: String,
        default: ""
      },

      termosUso: {
        type: String,
        default: ""
      },

      politicaPrivacidade: {
        type: String,
        default: ""
      }
    },

    atualizadoPor: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    minimize: false
  }
);

/* ===============================
   MÉTODOS
=============================== */

configuracaoSchema.methods.ativarManutencao = function ({
  titulo = "",
  mensagem = "",
  previsaoRetorno = "",
  atualizadoPor = ""
} = {}) {
  this.modoManutencao = true;
  this.ambiente = "manutencao";

  if (titulo) this.manutencaoTitulo = titulo;
  if (mensagem) this.manutencaoMensagem = mensagem;
  if (previsaoRetorno) this.previsaoRetorno = previsaoRetorno;
  if (atualizadoPor) this.atualizadoPor = atualizadoPor;

  return this.save();
};

configuracaoSchema.methods.desativarManutencao = function (atualizadoPor = "") {
  this.modoManutencao = false;
  this.ambiente = "producao";
  this.previsaoRetorno = "";

  if (atualizadoPor) this.atualizadoPor = atualizadoPor;

  return this.save();
};

configuracaoSchema.methods.atualizarComissao = function (novaComissao, atualizadoPor = "") {
  this.comissaoPadrao = Number(novaComissao || 20);

  if (atualizadoPor) this.atualizadoPor = atualizadoPor;

  return this.save();
};

/* ===============================
   STATICS
=============================== */

configuracaoSchema.statics.obterConfiguracao = async function () {
  let config = await this.findOne({ chave: "sistema" });

  if (!config) {
    config = await this.create({
      chave: "sistema"
    });
  }

  return config;
};

/* ===============================
   INDEXES
=============================== */

configuracaoSchema.index({ chave: 1 });
configuracaoSchema.index({ modoManutencao: 1 });
configuracaoSchema.index({ ambiente: 1 });

module.exports = mongoose.model("Configuracao", configuracaoSchema);
