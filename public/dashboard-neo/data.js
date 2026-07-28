export const modules=[
 {key:"reflexivos",title:"Reflexivos",icon:"i-layers",description:"Leitura e interpretação estratégica.",progress:0},
 {key:"gatilhos",title:"Gatilhos",icon:"i-target",description:"Reconheça padrões e momentos decisivos.",progress:0},
 {key:"camaleoes",title:"Camaleões",icon:"i-star",description:"Adaptação e análise de cenários.",progress:0},
 {key:"magnetismo",title:"Magnetismo",icon:"i-activity",description:"Comportamento e força das sequências.",progress:0},
 {key:"fibonacci",title:"Fibonacci",icon:"i-chart",description:"Sequências, ciclos e proporções.",progress:0},
 {key:"pitagoras",title:"Pitágoras",icon:"i-layers",description:"Estrutura lógica e relações numéricas.",progress:0}
];
export const library=[
 {icon:"i-book",title:"Aulas em vídeo",description:"Conteúdos organizados por módulo e nível.",target:"modulos"},
 {icon:"i-note",title:"Materiais de apoio",description:"Resumos, guias e conteúdos complementares.",target:"modulos"},
 {icon:"i-edit",title:"Anotações",description:"Crie notas online durante seus estudos.",target:"notas"},
 {icon:"i-exam",title:"Avaliações",description:"Teste seu aprendizado e acompanhe resultados.",target:"provas"},
 {icon:"i-game",title:"Treino interativo",description:"Aprenda com desafios e minigames.",target:"minigames"},
 {icon:"i-star",title:"Favoritos",description:"Salve conteúdos importantes para revisar.",target:"favoritos"}
];
export const shortcuts=[
 {title:"Dashboard",description:"Voltar ao painel principal",icon:"i-home",target:"inicio",keywords:"inicio home principal"},
 {title:"Notas",description:"Criar e consultar anotações",icon:"i-note",target:"notas",keywords:"anotacoes caderno texto"},
 {title:"Minigames",description:"Aprender jogando",icon:"i-game",target:"minigames",keywords:"jogos zero one eclipse desafio"},
 {title:"Estudo",description:"Biblioteca de conteúdos",icon:"i-book",target:"estudo",keywords:"materiais pdf aulas"},
 {title:"Módulos",description:"Trilha de aprendizado",icon:"i-layers",target:"modulos",keywords:"reflexivos gatilhos camaleoes magnetismo fibonacci pitagoras"},
 {title:"Suporte",description:"Abrir ou acompanhar chamado",icon:"i-support",target:"suporte",keywords:"ajuda atendimento problema"},
 {title:"Perfil",description:"Conta, foto e aparência",icon:"i-user",target:"perfil",keywords:"usuario telefone tema claro escuro"},
 {title:"Roleta",description:"Race, Racetrack e ferramentas",icon:"i-roulette",target:"roleta",keywords:"race racetrack operacional"},
 {title:"Provas",description:"Avaliações e resultados",icon:"i-exam",target:"provas",keywords:"teste avaliacao resultado nota"},
 {title:"Favoritos",description:"Conteúdos salvos",icon:"i-star",target:"favoritos",keywords:"salvos estrela"}
];
export const navIcons={inicio:"i-home",notas:"i-note",minigames:"i-game",estudo:"i-book",modulos:"i-layers",suporte:"i-support",perfil:"i-user",roleta:"i-roulette",provas:"i-exam",favoritos:"i-star"};
export function icon(name,extra=""){return `<svg class="${extra}" aria-hidden="true"><use href="assets/dashboard-icons.svg#${name}"></use></svg>`;}
