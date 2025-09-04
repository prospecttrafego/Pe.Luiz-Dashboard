import React, { useState, useEffect } from 'react';
import './ContentDashboard.css';

const ContentDashboard = () => {
  const [data, setData] = useState([]);
  const [kpis, setKpis] = useState({});
  const [upcomingContent, setUpcomingContent] = useState([]);
  const [pilarData, setPilarData] = useState([]);
  const [tipoData, setTipoData] = useState([]);
  const [canalData, setCanalData] = useState([]);
  const [backlogData, setBacklogData] = useState([]);
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [loading, setLoading] = useState(true);

  const URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRvCPmM9GlwcFAjaG9Hoh2P1XUWnjd55riEvx_lK-A6juYXtE7SUHvvx9NnzGP0NVfujkrUDirCzB4g/pub?gid=198017202&single=true&output=csv";

  const funnelMapping = {
    "Planejado": "Pré-produção",
    "Roteiro": "Produção",
    "Para gravar": "Produção",
    "Editando": "Produção",
    "Revisão": "Qualidade",
    "Aguardando aprovação": "Qualidade",
    "Programado": "Publicação",
    "Postado": "Publicação"
  };

  const pilarKeywords = {
    'Palavra Vivida': ['palavra', 'evangelho', 'bíblia', 'escritura', 'homilia', 'reflexão'],
    'Verdade que Liberta': ['verdade', 'liberta', 'conhecimento', 'ensino', 'doutrina'],
    'Fé com Obras': ['obras', 'ação', 'caridade', 'solidariedade', 'serviço'],
    'Espiritualidade Encarnada': ['oração', 'contemplação', 'espiritual', 'meditação'],
    'Santos e Exemplos': ['santo', 'santa', 'exemplo', 'testemunho', 'vida'],
    'Direção Pastoral': ['pastoral', 'direção', 'orientação', 'aconselhamento'],
    'Comunhão e Serviço': ['comunidade', 'comunhão', 'união', 'fraternidade']
  };

  const tipoMapping = {
    'C': 'Card/Carrossel',
    'V': 'Vídeo',
    'E': 'Corte'
  };

  const parseCSV = (csvText) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    return lines.slice(1).filter(line => line.trim()).map(line => {
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].replace(/"/g, '').trim() : '';
      });
      
      return row;
    });
  };

  const parseDate = (dateStr, dayFirst = true) => {
    if (!dateStr) return null;
    
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    let day, month, year;
    if (dayFirst) {
      [day, month, year] = parts;
    } else {
      [month, day, year] = parts;
    }
    
    if (year.length === 2) {
      year = '20' + year;
    }
    
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  };

  const inferPilar = (tema, conteudo) => {
    const text = `${tema} ${conteudo}`.toLowerCase();
    
    for (const [pilar, keywords] of Object.entries(pilarKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return pilar;
      }
    }
    
    return 'Outros';
  };

  const processData = (rawData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const processedData = rawData.map((row, index) => {
      const data = parseDate(row.Data);
      const prazoAprovacao = parseDate(row['Prazo para aprovação']);
      
      // Normalizar Tipo com mapeamento de tags
      let tipo = row.Tipo;
      if (tipoMapping[tipo]) {
        tipo = tipoMapping[tipo];
      }
      
      // Inferir Pilar se não estiver preenchido
      let pilar = row.Pilar;
      if (!pilar || pilar.trim() === '') {
        pilar = inferPilar(row.Tema || '', row.Conteúdo || '');
      }
      
      // Criar ID estável
      const dateStr = data ? data.toISOString().slice(0, 10).replace(/-/g, '') : 'NODATE';
      const hash = Math.abs(((row.Tema || '') + (row.Conteúdo || '')).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0)).toString(16).slice(0, 6);
      const idConteudo = `${dateStr}-${(row.Canal || '').replace(/\s+/g, '')}-${tipo.replace(/\s+/g, '')}-${hash}`;
      
      return {
        ...row,
        id_conteudo: idConteudo,
        Data: data,
        'Prazo para aprovação': prazoAprovacao,
        Tipo: tipo,
        Pilar: pilar,
        Etapa: funnelMapping[row.Status] || 'N/A',
        Atrasado: prazoAprovacao && 
                  prazoAprovacao < today && 
                  !['Programado', 'Postado'].includes(row.Status),
        semana_iso: data ? getWeekNumber(data) : null,
        dia_da_semana: data ? data.getDay() || 7 : null // 1=Seg, 7=Dom
      };
    }).filter(row => row.Data || row['Prazo para aprovação']);

    return processedData;
  };

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };

  const calculateKPIs = (processedData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Meta mensal fixo: setembro 2024 (01/09 a 30/09)
    const metaStart = new Date(2024, 8, 1); // setembro = mês 8 (0-indexed)
    const metaEnd = new Date(2024, 8, 30);
    
    const bufferContent = processedData.filter(row => 
      row.Status === 'Aguardando aprovação' &&
      row['Prazo para aprovação'] &&
      row['Prazo para aprovação'] >= metaStart &&
      row['Prazo para aprovação'] <= metaEnd
    );
    
    const coveredDays = new Set(
      bufferContent.map(row => row['Prazo para aprovação'].toDateString())
    ).size;
    
    const metaBufferDays = 14; // Fixo conforme especificação
    const percentualMetaBuffer = Math.round(Math.min(coveredDays, metaBufferDays) / metaBufferDays * 100 * 10) / 10;
    const missingDaysForMeta = Math.max(metaBufferDays - coveredDays, 0);
    
    // Sugestão de próximos dias para buffer
    const allDaysInSeptember = [];
    for (let d = new Date(metaStart); d <= metaEnd; d.setDate(d.getDate() + 1)) {
      allDaysInSeptember.push(new Date(d));
    }
    
    const coveredDaysSet = new Set(bufferContent.map(row => row['Prazo para aprovação'].toDateString()));
    const uncoveredDays = allDaysInSeptember
      .filter(d => !coveredDaysSet.has(d.toDateString()))
      .slice(0, missingDaysForMeta)
      .map(d => d.toLocaleDateString('pt-BR'));
    
    const totalPlanned = processedData.length;
    const totalPosted = processedData.filter(row => row.Status === 'Postado').length;
    const overdue = processedData.filter(row => row.Atrasado).length;
    
    return {
      total_planejado: totalPlanned,
      total_postado: totalPosted,
      taxa_conclusao: Math.round((totalPosted / totalPlanned) * 100 * 10) / 10,
      conteudos_atrasados: overdue,
      buffer_meta_dias: metaBufferDays,
      buffer_dias_cobertos: coveredDays,
      buffer_percentual_meta: percentualMetaBuffer,
      buffer_faltam_dias_para_meta: missingDaysForMeta,
      sugestao_proximos_dias_para_buffer: uncoveredDays,
      periodo_meta: {
        inicio: metaStart.toLocaleDateString('pt-BR'),
        fim: metaEnd.toLocaleDateString('pt-BR')
      },
      proximos_7_dias: processedData
        .filter(row => {
          const nextWeek = new Date(today);
          nextWeek.setDate(today.getDate() + 7);
          return row.Data && row.Data >= today && row.Data <= nextWeek;
        })
        .map(row => ({
          data: row.Data.toLocaleDateString('pt-BR'),
          canal: row.Canal,
          tema: row.Tema,
          tipo: row.Tipo,
          responsavel: row.Responsável
        }))
    };
  };

  const getUpcomingContent = (processedData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    return processedData
      .filter(row => 
        row.Data && 
        row.Data >= today && 
        row.Data <= nextWeek
      )
      .sort((a, b) => a.Data - b.Data);
  };

  const calculatePilarData = (processedData) => {
    const pilarStats = {};
    
    processedData.forEach(row => {
      const pilar = row.Pilar || 'Outros';
      if (!pilarStats[pilar]) {
        pilarStats[pilar] = { planejado: 0, postado: 0 };
      }
      pilarStats[pilar].planejado++;
      if (row.Status === 'Postado') {
        pilarStats[pilar].postado++;
      }
    });
    
    return Object.entries(pilarStats).map(([pilar, stats]) => ({
      pilar,
      ...stats,
      percentual: Math.round((stats.postado / stats.planejado) * 100 * 10) / 10
    }));
  };
  
  const calculateTipoData = (processedData) => {
    const tipoStats = {};
    
    processedData.forEach(row => {
      const tipo = row.Tipo || 'Outros';
      if (!tipoStats[tipo]) {
        tipoStats[tipo] = { planejado: 0, postado: 0 };
      }
      tipoStats[tipo].planejado++;
      if (row.Status === 'Postado') {
        tipoStats[tipo].postado++;
      }
    });
    
    return Object.entries(tipoStats).map(([tipo, stats]) => ({
      tipo,
      ...stats,
      percentual: Math.round((stats.postado / stats.planejado) * 100 * 10) / 10
    }));
  };
  
  const calculateCanalData = (processedData) => {
    const canalStats = {};
    
    processedData.forEach(row => {
      const canal = row.Canal || 'Outros';
      if (!canalStats[canal]) {
        canalStats[canal] = { planejado: 0, postado: 0 };
      }
      canalStats[canal].planejado++;
      if (row.Status === 'Postado') {
        canalStats[canal].postado++;
      }
    });
    
    return Object.entries(canalStats).map(([canal, stats]) => ({
      canal,
      ...stats,
      percentual: Math.round((stats.postado / stats.planejado) * 100 * 10) / 10
    }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(URL);
        const csvText = await response.text();
        const rawData = parseCSV(csvText);
        const processedData = processData(rawData);
        
        setData(processedData);
        setKpis(calculateKPIs(processedData));
        setUpcomingContent(getUpcomingContent(processedData));
        setPilarData(calculatePilarData(processedData));
        setTipoData(calculateTipoData(processedData));
        setCanalData(calculateCanalData(processedData));
        setBacklogData(processedData.filter(row => row.Atrasado));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getStatusColor = (status) => {
    const colors = {
      'Pré-produção': '#ffc107',
      'Produção': '#fd7e14',
      'Qualidade': '#20c997',
      'Publicação': '#0d6efd'
    };
    return colors[funnelMapping[status]] || '#6c757d';
  };

  if (loading) {
    return <div className="loading">Carregando dados...</div>;
  }

  const renderVisaoGeral = () => (
    <>
      <div className="kpi-grid">
        <div className="kpi-card">
          <h3>Total Planejado</h3>
          <div className="kpi-value">{kpis.total_planejado}</div>
        </div>
        
        <div className="kpi-card">
          <h3>Total Postado</h3>
          <div className="kpi-value">{kpis.total_postado}</div>
        </div>
        
        <div className="kpi-card">
          <h3>Taxa de Conclusão</h3>
          <div className="kpi-value">{kpis.taxa_conclusao}%</div>
        </div>
        
        <div className="kpi-card alert">
          <h3>Conteúdos Atrasados</h3>
          <div className="kpi-value">{kpis.conteudos_atrasados}</div>
        </div>
      </div>

      <div className="buffer-section">
        <div className="section-header">
          <h2>Meta de Buffer Mensal - Setembro</h2>
          <p>Período: {kpis.periodo_meta?.inicio} - {kpis.periodo_meta?.fim}</p>
        </div>
        
        <div className="buffer-grid">
          <div className="buffer-card">
            <h4>Meta (dias)</h4>
            <div className="buffer-value">{kpis.buffer_meta_dias}</div>
          </div>
          
          <div className="buffer-card">
            <h4>Dias Cobertos</h4>
            <div className="buffer-value">{kpis.buffer_dias_cobertos}</div>
          </div>
          
          <div className="buffer-card">
            <h4>% da Meta</h4>
            <div className="buffer-value">
              {kpis.buffer_percentual_meta}%
            </div>
            <div className="buffer-progress">
              <div 
                className="buffer-progress-fill"
                style={{ width: `${kpis.buffer_percentual_meta}%` }}
              ></div>
            </div>
          </div>
          
          <div className="buffer-card">
            <h4>Faltam Dias</h4>
            <div className="buffer-value alert">
              {kpis.buffer_faltam_dias_para_meta}
            </div>
          </div>
        </div>
        
        {kpis.sugestao_proximos_dias_para_buffer?.length > 0 && (
          <div className="suggestion-box">
            <h4>Sugestão - Próximos dias para buffer:</h4>
            <p>{kpis.sugestao_proximos_dias_para_buffer.join(', ')}</p>
          </div>
        )}
      </div>
    </>
  );

  const renderPilares = () => (
    <div className="pilares-section">
      <h2>Análise por Pilares</h2>
      <div className="table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Pilar</th>
              <th>Planejado</th>
              <th>Postado</th>
              <th>% Realizado</th>
            </tr>
          </thead>
          <tbody>
            {pilarData.map((item, index) => (
              <tr key={index}>
                <td className="pillar-name">{item.pilar}</td>
                <td>{item.planejado}</td>
                <td>{item.postado}</td>
                <td className="percentage">{item.percentual}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTipo = () => (
    <div className="tipo-section">
      <h2>Análise por Tipo de Conteúdo</h2>
      <div className="table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Planejado</th>
              <th>Postado</th>
              <th>% Realizado</th>
            </tr>
          </thead>
          <tbody>
            {tipoData.map((item, index) => (
              <tr key={index}>
                <td className="tipo-name">{item.tipo}</td>
                <td>{item.planejado}</td>
                <td>{item.postado}</td>
                <td className="percentage">{item.percentual}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCanal = () => (
    <div className="canal-section">
      <h2>Análise por Canal</h2>
      <div className="table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Canal</th>
              <th>Planejado</th>
              <th>Postado</th>
              <th>% Realizado</th>
            </tr>
          </thead>
          <tbody>
            {canalData.map((item, index) => (
              <tr key={index}>
                <td className="canal-name">{item.canal}</td>
                <td>{item.planejado}</td>
                <td>{item.postado}</td>
                <td className="percentage">{item.percentual}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderOperacional = () => (
    <>
      <div className="upcoming-section">
        <h2>Próximos 7 Dias</h2>
        <div className="table-container">
          <table className="upcoming-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Canal</th>
                <th>Tipo</th>
                <th>Tema</th>
                <th>Status</th>
                <th>Etapa</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {upcomingContent.length > 0 ? (
                upcomingContent.map((item, index) => (
                  <tr key={index} className={item.Atrasado ? 'overdue' : ''}>
                    <td>{item.Data?.toLocaleDateString('pt-BR')}</td>
                    <td>{item.Canal}</td>
                    <td>{item.Tipo}</td>
                    <td>{item.Tema}</td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(item.Status) }}
                      >
                        {item.Status}
                      </span>
                    </td>
                    <td>{item.Etapa}</td>
                    <td>{item.Responsável || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-data">
                    Nenhum conteúdo programado para os próximos 7 dias
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="backlog-section">
        <h2>Backlog - Conteúdos Atrasados</h2>
        <div className="table-container">
          <table className="backlog-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Canal</th>
                <th>Tipo</th>
                <th>Tema</th>
                <th>Status</th>
                <th>Prazo Aprovação</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {backlogData.length > 0 ? (
                backlogData.map((item, index) => (
                  <tr key={index} className="overdue">
                    <td>{item.Data?.toLocaleDateString('pt-BR')}</td>
                    <td>{item.Canal}</td>
                    <td>{item.Tipo}</td>
                    <td>{item.Tema}</td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(item.Status) }}
                      >
                        {item.Status}
                      </span>
                    </td>
                    <td>{item['Prazo para aprovação']?.toLocaleDateString('pt-BR') || '-'}</td>
                    <td>{item.Responsável || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-data">
                    Nenhum conteúdo atrasado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'pilares': return renderPilares();
      case 'tipo': return renderTipo();
      case 'canal': return renderCanal();
      case 'operacional': return renderOperacional();
      default: return renderVisaoGeral();
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header padre-luiz">
        <div className="brand-section">
          <h1>Dashboard de Conteúdo</h1>
          <p className="brand-subtitle">Padre Luiz Augusto & Associação Santa Teresinha</p>
        </div>
        <p className="last-update">Atualizado em: {new Date().toLocaleString('pt-BR')}</p>
      </header>

      <nav className="dashboard-nav">
        <button 
          className={`nav-tab ${activeTab === 'visao-geral' ? 'active' : ''}`}
          onClick={() => setActiveTab('visao-geral')}
        >
          Visão Geral
        </button>
        <button 
          className={`nav-tab ${activeTab === 'pilares' ? 'active' : ''}`}
          onClick={() => setActiveTab('pilares')}
        >
          Pilares
        </button>
        <button 
          className={`nav-tab ${activeTab === 'tipo' ? 'active' : ''}`}
          onClick={() => setActiveTab('tipo')}
        >
          TIPO
        </button>
        <button 
          className={`nav-tab ${activeTab === 'canal' ? 'active' : ''}`}
          onClick={() => setActiveTab('canal')}
        >
          CANAL
        </button>
        <button 
          className={`nav-tab ${activeTab === 'operacional' ? 'active' : ''}`}
          onClick={() => setActiveTab('operacional')}
        >
          Operacional
        </button>
      </nav>

      <main className="dashboard-content">
        {renderContent()}
      </main>
    </div>
  );
};

export default ContentDashboard;