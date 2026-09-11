# Dashboard e navegação — setembro de 2026

## Redesenho visual de 10 de setembro

O dashboard foi recomposto com uma área principal com o Primo, biblioteca de capas existentes verificadas, resumo compacto da conta, atalhos de prática e cartão de retomada. Referência de organização visual pesquisada: https://www.masterclass.com/categories/design-creative-arts. Nenhum código ou imagem dessa plataforma foi copiado.

A busca global e Ctrl/Cmd+K levam à busca de módulos. O filtro "Acessados por aqui" e a retomada registram apenas aberturas feitas por esse dashboard, em armazenamento local separado pelo ID do usuário autenticado (`turma.workspace.visited.<id>`). Não são métricas de conclusão nem progresso de aula. O backend continua sendo a única autoridade de acesso.

Testes adicionais verificaram filtros, retomada após atualização, isolamento entre contas e carregamento das oito capas. O visual também foi conferido em 1440px e 390px. As imagens corrompidas antigas não foram usadas no dashboard.

## Onde continuar o dashboard

- `public/dashboard.html`: estrutura do novo espaço do aluno.
- `public/dashboard-premium-workspace.css`: visual independente das camadas antigas.
- `public/dashboard-premium-workspace.js`: busca, menu, dados reais, estados vazios/erro e logout.
- `public/dashboard-notifications-live.js`: avisos administrativos e ativação de push preservados.

O dashboard usa `/me` e `/dashboard-premium/home`. Não exibe o gráfico de exemplo, os níveis fictícios ou percentuais fixos do dashboard antigo. Dias com atividade significam dias distintos nos últimos 30 dias, não uma sequência consecutiva. Não altera os dados nem a estrutura do banco. O painel administrativo e o painel comercial permanecem nas versões anteriores.

## Endereços

O servidor redireciona páginas conhecidas com `.html` para endereços canônicos. `/painel-admin` é um alias de `/admin`. `page-navigation.js` guarda a página real em cada entrada do histórico e mostra `/` na barra. Atualização e Voltar restauram a página através do servidor e suas verificações de acesso; não há iframe nem cookie de navegação compartilhado entre abas. Durante uma requisição o navegador ainda pode mostrar brevemente o endereço solicitado. Copiar o endereço da barra copia apenas o domínio; links específicos continuam acessíveis quando digitados.

Scripts que precisam identificar a tela devem usar `window.TurmaNavigation?.pathname ?? location.pathname`; abas internas devem consultar `TurmaNavigation.hash`. Não remover o bootstrap ou voltar a ler diretamente o endereço visível nesses pontos.

## Proteções

- Admin e Vendas exigem permissão no servidor antes de servir a página, inclusive nos aliases de hospedagem `/__staff/*`.
- Premium continua passando por autenticação e assinatura no servidor; o bootstrap nunca concede acesso.
- `X-Frame-Options: DENY` e `frame-ancestors 'none'` foram mantidos.
- Cópia, arraste e menu de contexto são restringidos no conteúdo Premium. Campos de formulário e conteúdo editável continuam permitindo copiar/colar.
- Impressão do conteúdo reservado é suprimida; alguns atalhos de inspeção são desencorajados. Não há detecção de DevTools ou punição de usuários.
- `display-capture=()` impede o documento de iniciar a API de captura em navegadores compatíveis; não impede capturas feitas pelo sistema operacional ou por outros aplicativos. Referência: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/display-capture
- Avisos não podem executar links `javascript:` ou `data:`.

Essas restrições de interface não equivalem a DRM nem impedem que um usuário autorizado obtenha o conteúdo que seu navegador recebeu.

## Verificação

### Atualização v3 — temas e interações

- `dashboard-premium-appearance.js` aplica a preferência de tema antes de renderizar e controla tema, recolhimento do menu e temporizador. `dashboard-premium-themes.css` contém os dois temas e os novos layouts.
- Tema e menu compacto são preferências deste navegador. O histórico de módulos continua separado por conta. O tema se aplica a este dashboard; as demais páginas não foram redesenhadas nesta rodada.
- O banner usa o retrato original no escuro e uma edição com fundo cinza/lilás no claro (`primo-portrait-light-v5.webp`). A troca acompanha o tema; detalhes em `PORTRAIT-V5.md`. As oito capas agora têm 16 imagens geradas (escuro/claro), em `public/assets/modules-v4/`. Arquivos e prompts atuais estão em `WORKSPACE-V4-IMAGES.md`. A arte abstrata anterior foi retirada.
- Temporizador de foco: 15, 25 ou 45 minutos, pausa, retomada e reinício. Calcula pelo horário final para compensar abas em segundo plano. Não registra atividade no servidor e é reiniciado ao recarregar ou sair da página.
- Menu móvel tem fundo clicável, contenção de foco, Escape e bloqueio da rolagem ao abrir. Barra inferior oferece quatro atalhos. Animações de entrada e interação respeitam a preferência de movimento reduzido.
- Testes de navegador v3: persistência do tema e menu, imagens dos dois temas, contagem/pausa/conclusão do temporizador, larguras 360/390/768/1024/1440, teclado no menu e movimento reduzido. Dados de teste isolados; sem publicação ou validação contra produção.
- Repetir com `node scripts/workspace-v3-browser-regression.cjs`, usando Chrome e Playwright instalados. `PLAYWRIGHT_MODULE` pode apontar para o pacote Playwright disponível no ambiente; `WORKSPACE_PREVIEW_DIR` pode definir a pasta de capturas. Sem essa variável, as capturas vão para uma pasta temporária. O teste usa um servidor local isolado e não precisa de credenciais.

- `npm run validate`
- `npm run security:regression`
- `npm run sales:regression`
- `npm run navigation:regression` (também no CI)
- `npm audit --audit-level=high`

Testes locais de navegador cobriram desktop/mobile, busca com acentos, resultados vazios, API indisponível/nova tentativa, atualizar, Voltar, histórico de abas, cópia restrita e colagem em campos. Esses testes usaram dados de teste isolados, sem credenciais de produção. Integrações MySQL, Bestfy e entrega de push não foram exercitadas em produção nesta rodada. A configuração `.htaccess` depende da aplicação pelo provedor de hospedagem.

### Refinamento visual v6

`dashboard-premium-polish.css` refina a hierarquia visual, espaçamentos, cartões, filtros, botões e cabeçalho fixo com fundo translúcido. Transições do menu lateral e entradas suaves respeitam movimento reduzido. No mobile, a margem da página não é animada para evitar deslocamentos durante mudanças de largura. O temporizador ganhou uma barra nativa de progresso, calculada a partir do tempo restante, com destaque visual durante a sessão. As imagens e a troca dos fundos do retrato foram preservadas. Testes de navegador passaram nos dois temas, em cinco larguras, incluindo progresso e reinício do temporizador.
