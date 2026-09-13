# Central de estudos e foco — setembro de 2026

A biblioteca e os oito módulos seguem o visual do dashboard e da Roleta Real. As rotas existentes continuam funcionando. As capas de `assets/modules-v4` mudam junto com os temas claro e escuro. O dashboard mostra as 24 etapas e os oito módulos reais, com a retomada vinculada à conta.

## Experiência de estudo

Cada módulo contém explicação, demonstração em três etapas, caderno e um jogo próprio. Apenas abrir uma etapa não a conclui. O exemplo exige percorrer as três etapas e aplicar qualquer edição pendente. Cada sessão de jogo tem cinco desafios; três acertos concluem a etapa. A resposta recebe correção e explicação, e pode ser revisada depois.

| Módulo | Jogo | Mecânica |
| --- | --- | --- |
| Gêmeos | Guardião do ciclo | Decisões sobre família, encerramento e reset |
| Espelhos | Sala dos reflexos | Conexões entre pares |
| Fibonacci | Oficina de códigos | Soma e diferença em campos separados |
| Magneto | Circuito magnético | Ativação de destinos num painel de conexões |
| Camaleões | Detetive dos dígitos | Resultado comum e representantes ausentes |
| Pitágoras | Arquiteto da Race | Construção de famílias na roda |
| Cavalo | Corrida das famílias | Classificação de uma fila nos três cavalos ou fora deles |
| Eclipse Zero | Órbita em sequência | Reconstrução ordenada dos terminais 0 e 9 |

Os jogos têm níveis de dificuldade diferentes, sem limite de tempo. As rodadas variam os exemplos; conexões, classificações, sequências e construção de figuras aumentam sua complexidade ao longo da sessão. As regras do material original foram preservadas. Os exercícios não calculam probabilidades nem simulam ganhos.

A Race usa a ordem da roda europeia, com 37 posições, origem, alvos, vizinhos e conexões. No celular, a grade é a apresentação inicial; o aluno pode alternar para a Race, com rolagem quando necessária. Nos exemplos, pode inspecionar números, ocultar a camada de vizinhos e explorar cenários alternativos.

## Progresso por conta

`GET /study/state` e `POST /study/state` exigem autenticação e acesso Premium. O proprietário é obtido da sessão, e o cabeçalho `X-Study-Account` impede que uma aba antiga envie alterações para outra conta após uma troca de login. IDs fornecidos no corpo não selecionam outro aluno.

O MySQL armazena etapas, favoritos da trilha, anotações de cada módulo, último módulo/etapa, valores e posição dos exemplos, respostas em andamento, melhor pontuação, sessões concluídas e timer. A etapa Minigame e a pontuação são calculadas no servidor pelas respostas recebidas. O caderno e os favoritos da trilha continuam separados das áreas gerais legadas de Anotações e Favoritos.

As alterações são operações pequenas, serializadas numa transação com bloqueio da linha do aluno. Etapas concluídas são acumuladas; mudar uma anotação não substitui o estado completo da conta. Reenvios usam identificadores únicos. A conclusão de um jogo utiliza um identificador fixo por sessão, evitando contagem duplicada após uma falha de rede. Para campos editáveis no mesmo módulo, prevalece a última alteração recebida pelo servidor.

O navegador mantém cache e uma fila pendente por conta. Após uma interrupção, reenvia a fila e informa quando a sincronização está pendente. O envio final usa `keepalive`. Abertura, retorno à janela e reconexão atualizam o estado; páginas visíveis consultam novamente a cada 20 segundos. Para aparecer em outro dispositivo, a alteração precisa ter chegado ao servidor. Se o armazenamento local estiver indisponível, a sincronização online continua funcionando; alterações ainda não enviadas permanecem somente na página aberta.

Chaves legadas sem identificação de conta são preservadas e não são importadas automaticamente, pois não permitem atribuir o histórico ao aluno correto. Nenhum progresso de outra conta é usado como ponto de partida.

## Timer de foco

O dashboard oferece sessões de 15, 25 e 45 minutos. Ao iniciar, aparece um painel pequeno, arrastável por mouse/toque e movido também pelas setas do teclado; Shift aumenta o passo. Minimizar mantém uma bolha para reabrir o painel. A posição é ajustada à tela e guardada por conta neste dispositivo.

O servidor salva o horário de término. Atualizar, trocar de página ou fechar o navegador não reinicia a sessão. Ao retornar, o tempo é recalculado; uma sessão que terminou com a página fechada aparece concluída. Pausar, continuar e reiniciar alteram o estado da conta, com revisão para detectar comandos concorrentes. Uma sessão iniciada continua contando sem conexão; alterar seu estado exige confirmação do servidor. Dias de foco representam sessões efetivamente concluídas.

O painel acompanha dashboard, estudo, Roleta Real e outras páginas de aluno com acesso Premium. `protected.js` passa a aceitar também a sessão por cookie, validando-a em `/me`; logout chama o servidor mesmo sem token no armazenamento do navegador. A versão global dos recursos foi atualizada para evitar arquivos antigos em cache.

## Arquivos

- `public/study-curriculum.js`: explicações, tabelas e cálculos originais.
- `public/study-games.js`: oito mecânicas, questões determinísticas e correção compartilhada.
- `public/study-game-ui.js`: interfaces específicas dos jogos.
- `public/study-state-model.js`: operações, validação, cálculo do progresso e transições do timer.
- `services/study-state.js` e `routes/study-state.js`: persistência MySQL, transações e API autenticada.
- `public/study-sync.js`: estado da conta, fila de reenvio e sincronização.
- `public/study-workspace.js`, `.css` e `study-appearance.js`: biblioteca e módulos.
- `public/study-focus.js` e `.css`: painel compartilhado do timer.
- `scripts/build-study-pages.cjs`: gera as nove páginas de estudo.

As tabelas `estudo_estado` e `estudo_operacoes` são criadas de forma idempotente no primeiro acesso, usando a conexão MySQL existente, com chaves estrangeiras para `usuarios`. Não há nova dependência de produção nem novo serviço externo. A implantação deve incluir backend e frontend juntos. Não executar scripts de teste contra dados de produção.

## Verificação

- `npm run validate`: sintaxe JavaScript.
- `npm run study:regression`: regras, valores limítrofes, ordem da roda, imagens e recursos protegidos.
- `npm run study:accounts`: jogos determinísticos, pontuação no servidor, isolamento, concorrência, reenvios, rollback e conclusão do timer após sair. Usa a implementação real do serviço e uma conexão transacional em memória.
- `npm run study:browser`: navegador real com o roteador e serviço de estudo, contas fictícias e a conexão em memória. Verifica os 40 desafios, aprovação/reprovação, temas, busca, responsividade, retomada entre contextos, falha de sincronização, notas, dashboard e timer em outras páginas. `STUDY_BROWSER_FOCUS_ONLY=1` executa apenas a parte do dashboard/timer com progresso preparado na fixture.
- As regressões existentes de segurança, vendas e navegação permanecem aplicáveis.

Playwright e Chromium são necessários apenas para a verificação visual. `PLAYWRIGHT_MODULE` e `STUDY_CHROMIUM_PACKAGE` podem indicar instalações existentes; `STUDY_PREVIEW_DIR` configura a pasta temporária das capturas. A fixture não acessa alunos, MySQL de produção ou Bestfy. A compatibilidade da integração MySQL foi conferida com o esquema existente; os testes automatizados locais utilizam a conexão em memória.
