# Dashboard de Conteúdo

Dashboard React.js para análise de planejamento de conteúdo baseado na planilha Google Sheets.

## Funcionalidades

- **KPIs Principais**: Total planejado, postado, taxa de conclusão e conteúdos atrasados
- **Meta de Buffer Mensal**: Acompanha quantos dias têm conteúdo pronto para aprovação
- **Cronograma**: Lista conteúdos dos próximos 7 dias
- **Indicadores Visuais**: Status coloridos e alertas para conteúdos atrasados
- **Design Responsivo**: Adaptado para desktop, tablet e mobile

## Como usar

1. Instale as dependências:
```bash
npm install
```

2. Execute o projeto:
```bash
npm start
```

3. Acesse http://localhost:3000

## Estrutura dos Dados

O dashboard lê dados de uma planilha Google Sheets pública e processa:

- **Status**: Mapeia para etapas do funil (Pré-produção → Produção → Qualidade → Publicação)
- **Prazos**: Identifica conteúdos atrasados baseado na data de aprovação
- **Buffer**: Calcula quantos dias do mês atual têm conteúdo "Aguardando aprovação"

## Personalização

Para usar com sua própria planilha, atualize a variável `URL` em `ContentDashboard.js` com sua URL de planilha Google Sheets publicada como CSV.

## Estrutura Esperada da Planilha

- Data
- Canal  
- Tipo
- Tema
- Status
- Prazo para aprovação