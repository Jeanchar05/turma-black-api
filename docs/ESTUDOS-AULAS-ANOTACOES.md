# Estudos, aulas e caderno do aluno

A Race usa um componente único nos exemplos, nos jogos dos estudos e na Roleta Real. A geometria acompanha a largura disponível; no celular a pista é vertical e a mesa mostra três colunas, com o zero acima. As 37 posições mantêm a ordem europeia. Os oito módulos também têm um objetivo de aprendizagem, um exemplo resolvido, uma confusão comum e uma pergunta de revisão.

## Publicação de conteúdos

Em Módulos, a equipe autorizada usa **Gerenciar conteúdos** para cadastrar o link da aula (YouTube ou arquivo HTTPS MP4/WebM), o resumo escrito, a duração exibida e a publicação. Um conteúdo despublicado fica em rascunho. Os resumos publicados alimentam a leitura e o PDF. Antes de haver uma videoaula publicada, o material é identificado como guia de estudo. Não há vídeos demonstrativos publicados automaticamente.

No painel admin, **Instagram** cadastra o link de uma publicação/Reel, título, legenda, módulo relacionado e ação opcional do botão: estudo, PDF ou link HTTPS. Marcar Publicar e salvar disponibiliza o conteúdo em Módulos → Instagram. Desmarcar e salvar o retira da área do aluno. A disponibilidade do player depende da publicação original; há um link para abrir o vídeo externamente.

A publicação exige o cargo dev/dono/superadmin/admin e a permissão efetiva painelAdmin. Os rascunhos e os resumos ainda não publicados não são expostos no catálogo de alunos. Edições simultâneas de conteúdo são verificadas por revisão.

## Conta, progresso e anotações

O progresso das videoaulas usa o estado de estudo da conta, separado dos créditos dos jogos. A posição é registrada durante a reprodução, nas pausas e ao sair. O timer e os jogos continuam utilizando os serviços da implementação anterior.

As anotações mantêm a tabela dashboard_notas e os IDs existentes. A inicialização cria a tabela quando necessário e acrescenta revisao/ultima_mutacao e os campos legados ausentes. São necessárias as permissões de banco CREATE/ALTER que as outras áreas do dashboard já utilizam.

O editor oferece títulos, negrito, itálico, sublinhado, listas, citações, marca-texto, links, desfazer/refazer e checklist. Categorias, etiquetas, cor, favorito, destaque e arquivo organizam as notas. Há salvamento automático e botão Salvar; o status só confirma a conta depois da resposta do servidor. Edições pendentes ficam associadas à conta no dispositivo. Não se importa o antigo cache local sem identificação de proprietário.

A sincronização usa IDs estáveis, transações, revisão e identificação de operação para evitar duplicação em tentativas repetidas. Se a mesma nota mudou em outro dispositivo, o editor preserva a edição local e permite salvar uma cópia ou abrir a versão atual. A exclusão definitiva exige que a nota esteja na lixeira e que a revisão ainda corresponda à conta. O HTML é filtrado no servidor e no navegador.

O PDF é gerado no servidor em tema claro, com nome do aluno, conteúdo da nota, checklist e referências. O compartilhamento prepara o arquivo antes de abrir as opções nativas do dispositivo, mediante um clique. Navegadores sem compartilhamento de arquivos oferecem download e cópia do texto. As notas não ganham um endereço público. Os PDFs usam fontes Liberation incorporadas e licenciadas em services/pdf-assets.

## Verificação

- npm run validate
- npm run security:regression
- npm run navigation:regression
- npm run sales:regression
- npm run study:regression
- npm run study:accounts
- npm run learning:regression
- npm run notes:regression
- npm audit --audit-level=high

Os scripts study:browser, learning:browser e notes:browser usam Playwright com fixtures transacionais e contas distintas; não acessam o banco de produção. Para um Chromium portable, informe STUDY_CHROMIUM_PACKAGE com o caminho do pacote @sparticuz/chromium. learning:browser e notes:browser verificam as telas em seis larguras, temas, fluxos de publicação, retomada, edição, compartilhamento, conflitos e lixeira. Os players externos são simulados para verificar a integração; os links reais devem ser cadastrados pela equipe.

As fontes e o DOMPurify que o navegador carrega são distribuídos com o projeto, sem depender de CDNs. Ao atualizar DOMPurify, atualize também public/vendor/dompurify.min.js a partir da dependência e preserve a licença.
