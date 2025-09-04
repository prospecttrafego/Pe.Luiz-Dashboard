import React, { useState, useEffect } from 'react';
import './ContentDashboard.css';

const ContentDashboard = () => {
  const [data, setData] = useState([]);
  const [kpis, setKpis] = useState({});
  const [upcomingContent, setUpcomingContent] = useState([]);
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

  const processData = (rawData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const processedData = rawData.map(row => ({
      ...row,
      Data: parseDate(row.Data),
      'Prazo para aprovação': parseDate(row['Prazo para aprovação']),
      Etapa: funnelMapping[row.Status] || 'N/A',
      Atrasado: row['Prazo para aprovação'] && 
                parseDate(row['Prazo para aprovação']) < today && 
                !['Programado', 'Postado'].includes(row.Status)
    })).filter(row => row.Data || row['Prazo para aprovação']);

    return processedData;
  };

  const calculateKPIs = (processedData) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const bufferContent = processedData.filter(row => 
      row.Status === 'Aguardando aprovação' &&
      row['Prazo para aprovação'] &&
      row['Prazo para aprovação'] >= today &&
      row['Prazo para aprovação'] <= endOfMonth
    );
    
    const coveredDays = new Set(
      bufferContent.map(row => row['Prazo para aprovação'].toDateString())
    ).size;
    
    const remainingDaysInMonth = Math.max(
      Math.ceil((endOfMonth - today) / (1000 * 60 * 60 * 24)) + 1,
      0
    );
    
    const metaBufferDays = Math.min(14, remainingDaysInMonth);
    const percentualMetaBuffer = metaBufferDays > 0 
      ? Math.round(Math.min(coveredDays, metaBufferDays) / metaBufferDays * 100 * 10) / 10
      : 0;
    
    const missingDaysForMeta = Math.max(metaBufferDays - coveredDays, 0);
    
    const totalPlanned = processedData.length;
    const totalPosted = processedData.filter(row => row.Status === 'Postado').length;
    const overdue = processedData.filter(row => row.Atrasado).length;
    
    return {
      total_planejado: totalPlanned,
      total_postado: totalPosted,
      'taxa_conclusao_%': Math.round((totalPosted / totalPlanned) * 100 * 10) / 10,
      conteudos_atrasados: overdue,
      buffer_meta_dias: metaBufferDays,
      buffer_dias_cobertos: coveredDays,
      'buffer_percentual_meta_%': percentualMetaBuffer,
      buffer_faltam_dias_para_meta: missingDaysForMeta,
      periodo_meta: {
        inicio: today.toLocaleDateString('pt-BR'),
        fim: endOfMonth.toLocaleDateString('pt-BR')
      }
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard de Conteúdo</h1>
        <p>Atualizado em: {new Date().toLocaleString('pt-BR')}</p>
      </header>

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
          <div className="kpi-value">{kpis['taxa_conclusao_%']}%</div>
        </div>
        
        <div className="kpi-card alert">
          <h3>Conteúdos Atrasados</h3>
          <div className="kpi-value">{kpis.conteudos_atrasados}</div>
        </div>
      </div>

      <div className="buffer-section">
        <div className="section-header">
          <h2>Meta de Buffer Mensal</h2>
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
              {kpis['buffer_percentual_meta_%']}%
            </div>
            <div className="buffer-progress">
              <div 
                className="buffer-progress-fill"
                style={{ width: `${kpis['buffer_percentual_meta_%']}%` }}
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
      </div>

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
                <th>Prazo Aprovação</th>
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
                    <td>{item['Prazo para aprovação']?.toLocaleDateString('pt-BR') || '-'}</td>
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
    </div>
  );
};

export default ContentDashboard;