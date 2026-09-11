# Roleta Real

- O menu usa a mesma lista do dashboard, com Roleta Real no final.
- /roleta-real apresenta o minigame; o botão abre /roleta-reel, preservando links existentes para o simulador.
- As duas páginas exigem acesso Premium. URLs .html seguem a navegação canônica.
- A Race mantém o motor compartilhado e o sorteio independente. No celular a roda é apresentada em ordem europeia numa grade com alvos de toque de 44px; a outra visualização usa três colunas numéricas.
- Testes: npm run validate, security:regression, navigation:regression; scripts/reel-browser-regression.cjs e workspace-v3-browser-regression.cjs com PLAYWRIGHT_MODULE configurado para o runtime local.
