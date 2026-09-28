# Turma do Primo — Auditoria Apple HIG

## Objetivo

Aplicar princípios do Apple Design Skill / Apple Human Interface Guidelines à experiência da Turma do Primo sem copiar visualmente iOS/macOS. A identidade continua sendo da Turma do Primo: premium, tecnológica, roxo profundo, dourado pontual, Sora/Inter, superfícies escuras e glassmorphism apenas em camadas funcionais flutuantes.

**Tese do design:** transformar a plataforma em um ambiente de estudo e prática que pareça um produto próprio, confiável e rápido, com a jornada do aluno sempre mais importante do que a decoração.

**Elemento de assinatura:** contraste entre superfícies escuras sólidas, roxo da marca e detalhes dourados usados para progresso/momentos de destaque, apoiado pela arte original da Turma do Primo.

## Referência adotada

A auditoria segue os oito princípios destacados pelo Apple Design Skill — Purpose, Agency, Responsibility, Familiarity, Flexibility, Simplicity, Craft e Delight — e traduz as recomendações da HIG para uma aplicação web responsiva.

Princípios práticos usados no piloto:

- hierarquia por importância e progressive disclosure;
- layout guiado pelo espaço disponível, não por nome de dispositivo;
- áreas de toque importantes próximas de 44x44px;
- tipografia legível e escalável;
- safe areas para notch/Dynamic Island/home indicator;
- foco visível, labels acessíveis e feedback claro;
- Dark e Light projetados separadamente;
- movimento curto, funcional e opcional;
- blur somente em header, dock, drawer overlay e camadas flutuantes;
- conteúdo principal em superfícies sólidas.

## Resumo da auditoria

**Avaliação atual:** boa base funcional, mas a camada visual precisa de consolidação.

O sistema já possui vários fundamentos corretos: rotas reais, estados de loading, mensagens de erro compreensíveis, navegação mobile, suporte a tema claro/escuro, foco via teclado em diversos pontos e suporte a `prefers-reduced-motion`. O maior problema é a evolução histórica do CSS: várias camadas de estilos coexistem, há muitos tamanhos de texto entre 5 e 10px, controles menores que o ideal e decisões de cor/radius espalhadas em arquivos distintos.

O piloto não remove nem reescreve lógica. Ele adiciona uma camada de Design System e adapta somente Login, Dashboard e navegação/sidebar.

## Achados críticos

### 1. Inputs pequenos no Login mobile

O Login atual usa 12px em campos de autenticação. Em navegadores móveis, especialmente Safari, isso reduz legibilidade e pode provocar zoom ao focar o campo.

**Correção do piloto:** inputs mobile com 16px, altura confortável, foco visível e botão mostrar/ocultar senha com alvo de toque maior.

### 2. Microtipografia excessiva

Há labels importantes em 5–10px no Dashboard, cards, badges e navegação. Isso prejudica leitura e contraste percebido.

**Correção do piloto:** escala mínima mais confortável para informação real. Textos de 11–12px ficam restritos a metadados secundários; corpo fica prioritariamente em 13–16px.

### 3. Controles menores que o alvo confortável no mobile

Alguns toggles, botões e ícones ficam abaixo do alvo recomendado de aproximadamente 44x44px.

**Correção do piloto:** menu, tema, notificações, ações principais, tabs e dock passam a usar áreas de interação próximas de 44px ou superiores.

## Melhorias de alta prioridade

### Navegação

A navegação canônica existe, porém aparece como uma lista praticamente plana em algumas telas. O piloto organiza sem remover rotas:

**PLATAFORMA**
- Dashboard
- Estudo
- Módulos
- Roleta Operacional
- Roleta Real

**APRENDIZADO**
- Provas
- Gestão
- Anotações
- Favoritos

**CONTA**
- Perfil

Não foi criada uma rota fictícia de Configurações. Preferências continuam dentro de Perfil até existir uma tela real para isso.

### Dashboard

O Dashboard atual tem conteúdo útil, mas muitos blocos competem pelo mesmo peso visual.

**Piloto:** adiciona no topo um resumo progressivo com:
- progresso geral da jornada;
- módulo atual / continuar de onde parou;
- avaliação correspondente ao dia da semana.

Esses dados usam o estado já existente de estudo e as rotas atuais. O restante do Dashboard permanece disponível abaixo.

### Design tokens

As cores, bordas, radius, sombras, foco, motion e safe areas passam a ter uma fonte de decisão comum em `turma-design-system-v1.css`.

Isso não elimina os arquivos históricos no piloto; evita uma reescrita grande e cria uma base para migração incremental.

### Glassmorphism

O projeto usa blur em diversas superfícies. O novo padrão reserva transparência/blur para:
- topbar;
- dock mobile;
- backdrop/drawer;
- menus e overlays funcionais.

Cards de conteúdo usam superfícies sólidas.

## Inventário por área

### Login e cadastro

**Estado atual:** identidade forte, arte/portrait já integrada, abas Login/Cadastro, mostrar senha, força da senha e loading de autenticação.

**Problemas:** tipografia pequena, inputs de 12px, excesso de microcopy e densidade em larguras menores.

**Piloto:** corrigido visualmente sem tocar em autenticação.

### Dashboard

**Estado atual:** hero, continuar módulo, estatísticas, biblioteca, ferramentas, foco e atividade recente.

**Problemas:** hierarquia pouco clara, muitos cards com peso semelhante, sidebar estreita e microtipografia.

**Piloto:** nova hierarquia, resumo da jornada, sidebar 272px desktop, drawer adaptativo mobile e dock respeitando safe area.

### Sidebar / navegação mobile

**Estado atual:** já possui drawer, overlay, Escape, foco e focus trap; isso é uma base boa e foi preservada.

**Piloto:** melhora agrupamento, tamanho de alvo, leitura, aria state e adaptação por largura.

### Estudo / Módulos / Instagram / PDF

**Estado atual:** estrutura de estudo modular, páginas compartilhadas, loading e navegação comum. Módulos e conteúdo já possuem estado sincronizado.

**Próxima fase:** consolidar Módulos / Instagram / PDF em uma navegação contextual clara (segmented control/tabs), mantendo toda a lógica e mídia atuais.

### Provas

**Estado atual:** Prova Diária, Semanal e Desafio do Primo já possuem cards, número de questões, agenda, desempenho, filtros e workspace da prova.

**Próxima fase:** reforçar disponibilidade, bloqueio explicado, resultado anterior, dificuldade, progresso durante a prova e CTA dominante quando disponível.

### Gestão

**Estado atual:** banca atual, lucro/perda, planejamento, meta, stop, unidade, calendário, curva, histórico e modais.

**Próxima fase:** reforçar resumo mensal e estados positivo/negativo usando sinal +/−, ícone e texto além de cor; melhorar modais no mobile e transformar ações apropriadas em bottom sheets.

### Notas

**Estado atual:** app dinâmico de notas, loading, editor e diálogos de ação.

**Próxima fase:** lista → nota no mobile, navegação contextual no desktop, categorias/favoritos/lixeira mais claras, editor mais calmo e empty states acionáveis.

### Perfil

**Estado atual:** já está separado em Dados pessoais, Preferências, Segurança e Atividade, com dispositivos, estatísticas e ações rápidas.

**Próxima fase:** padronizar cards, tipografia, controles, sessões/dispositivos e preferências com os tokens novos.

### Favoritos

**Estado atual:** integrado à navegação e ao estado do aluno.

**Próxima fase:** empty state útil, filtros consistentes e cards alinhados ao Design System.

### Roleta Operacional

**Estado atual:** links reais, cards das mesas, tema claro/escuro, parceiro e ferramentas. Deve manter as artes e URLs existentes.

**Próxima fase:** apenas migrar tipografia, cards, controles e navegação para os tokens; não alterar links ou lógica.

### Roleta Real / minigames

**Estado atual:** simulador e prática separados da Roleta Operacional.

**Próxima fase:** melhorar entrada, controles de prática, leitura mobile e feedback sem transformar a tela em cassino visual excessivo.

### Modais / popups

**Estado atual:** há implementações diferentes entre Gestão, Notas, Perfil e áreas administrativas.

**Próxima fase:** padrão único com título, contexto, ação principal, cancelar/fechar, scroll interno e comportamento mobile apropriado.

### Loading / empty / errors / notificações

**Estado atual:** várias páginas já têm mensagens melhores que códigos crus e alguns loadings específicos.

**Próxima fase:** componentes reutilizáveis `Skeleton`, `EmptyState`, `InlineError` e `Toast`, preservando mensagens específicas de cada contexto.

### Temas

**Estado atual:** existe Dark/Light real em várias áreas, mas decisões estão espalhadas.

**Piloto:** novos tokens possuem variantes próprias para Dark e Light. Light usa cinza/lilás muito claro, sem branco estourado; Dark usa preto arroxeado e superfícies elevadas.

## Base reutilizável criada no piloto

Arquivos:

- `public/turma-design-system-v1.css`
- `public/turma-hig-login-v1.css`
- `public/turma-hig-dashboard-v1.css`
- `public/turma-hig-dashboard-v1.js`

Tokens principais:

- background / surface / elevated surface;
- semantic border;
- primary / secondary / tertiary text;
- accent / gold / success / warning / danger / info;
- radius sm/md/lg/xl;
- shadow sm/md/lg;
- motion fast/base/slow;
- safe-area variables;
- minimum interactive target.

## Plano de rollout após aprovação do piloto

1. Estudo + Módulos + Instagram + PDF.
2. Provas.
3. Gestão.
4. Notas + Favoritos.
5. Perfil.
6. Roleta Operacional + Roleta Real + minigames.
7. Suporte, notificações, admin e painel de vendas.
8. Consolidação final dos estilos antigos e remoção apenas de CSS comprovadamente redundante.

## Restrições de implementação

Durante todo o rollout:

- não alterar banco de dados por motivo visual;
- não mudar contratos de API sem necessidade funcional;
- não substituir autenticação;
- não apagar conteúdo real;
- não trocar URLs reais por placeholders;
- não remover funcionalidades para simplificar o layout;
- testar largura mínima e máxima antes de consolidar uma tela;
- manter a identidade visual da Turma do Primo acima de qualquer convenção estética da Apple.
