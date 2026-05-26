/**
 * CSV Processor - Lógica de procesamiento extraída de server.js
 * Funciona 100% en el navegador, sin dependencias de Node.js
 */

// Helper: Obtener fecha en zona horaria de Argentina (UTC-3)
function getArgentinaDate(dateObj = null) {
  let date;
  
  if (dateObj) {
    const offsetMs = 3 * 60 * 60 * 1000;
    date = new Date(dateObj.getTime() - offsetMs);
  } else {
    const utcNow = new Date();
    const offsetMs = 3 * 60 * 60 * 1000;
    date = new Date(utcNow.getTime() - offsetMs);
  }
  
  return date.toISOString().split('T')[0];
}

// Helper: Parsear fecha del CSV (formato: "2026-05-11 11:43:11")
function parseCSVDate(dateStr) {
  if (!dateStr) return null;
  
  const datePart = dateStr.split(' ')[0];
  
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return null;
  }
  
  return datePart;
}

/**
 * Procesa los datos del CSV - SOLO datos de HOY
 * Retorna también información de todas las fechas encontradas
 */
function processConversationData(rows) {
  const today = getArgentinaDate();
  const dataToday = {};
  const allDatesFound = new Set();
  
  let totalRowsWithToday = 0;
  let totalRowsProcessed = 0;

  rows.forEach((row, rowIndex) => {
    totalRowsProcessed++;
    
    const createdAtStr = row.createdAt || '';
    const dateKey = parseCSVDate(createdAtStr);
    
    if (!dateKey) {
      return;
    }

    allDatesFound.add(dateKey);
    
    if (dateKey !== today) {
      return;
    }
    
    totalRowsWithToday++;
    
    const department = (row.department || 'SIN_PANEL').trim();
    const connection = (row.connection || 'SIN_CAMPAÑA').trim();
    const tags = (row.conversationTags || '').trim();
    
    const hasTag = tags && tags !== '' && tags !== 'nan';

    if (!dataToday[department]) {
      dataToday[department] = {
        id: '',
        panel: department,
        total_mensajes_hoy: 0,
        cargas_hoy: 0,
        porcentaje_carga: '0.0%',
        campañas: {},
        detalle_por_origen: ['whaticket']
      };
    }

    dataToday[department].total_mensajes_hoy += 1;

    if (!dataToday[department].campañas[connection]) {
      dataToday[department].campañas[connection] = {
        mensajes: 0,
        cargas: 0
      };
    }

    dataToday[department].campañas[connection].mensajes += 1;

    if (hasTag) {
      dataToday[department].cargas_hoy += 1;
      dataToday[department].campañas[connection].cargas += 1;
    }
  });

  const panelsToday = Object.values(dataToday).map((panel, index) => {
    const total = panel.total_mensajes_hoy;
    const cargas = panel.cargas_hoy;
    const porcentaje = total > 0 ? ((cargas / total) * 100).toFixed(1) : '0.0';
    
    return {
      id: '',
      panel: panel.panel,
      total_mensajes_hoy: total,
      cargas_hoy: cargas,
      porcentaje_carga: `${porcentaje}%`,
      campañas: panel.campañas,
      detalle_por_origen: panel.detalle_por_origen
    };
  });

  panelsToday.sort((a, b) => b.total_mensajes_hoy - a.total_mensajes_hoy);

  panelsToday.forEach((item, index) => {
    item.id = index.toString();
  });

  return {
    panels: panelsToday,
    allDatesFound: Array.from(allDatesFound).sort().reverse(),
    hasDataToday: panelsToday.length > 0,
    today: today
  };
}

/**
 * Genera estadísticas para HOY
 */
function generateStatistics(result, totalRows) {
  const panelsToday = result.panels;
  const totalCampañas = new Set();
  let totalCargas = 0;
  let totalMensajes = 0;

  panelsToday.forEach(panel => {
    totalMensajes += panel.total_mensajes_hoy;
    totalCargas += panel.cargas_hoy;
    Object.keys(panel.campañas).forEach(camp => totalCampañas.add(camp));
  });

  return {
    total_conversaciones: totalMensajes,
    total_paneles: panelsToday.length,
    total_campañas: totalCampañas.size,
    total_cargas: totalCargas,
    paneles_top_3: panelsToday.slice(0, 3).map(item => ({
      panel: item.panel,
      mensajes: item.total_mensajes_hoy,
      cargas: item.cargas_hoy
    })),
    fecha_actual: result.today
  };
}

/**
 * Función principal: Procesa CSV en formato array de objetos
 */
function processCSV(data) {
  try {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        success: false,
        error: 'Datos inválidos o vacíos'
      };
    }

    // Validar columnas requeridas
    const requiredColumns = ['createdAt', 'connection', 'conversationTags', 'department'];
    const firstRow = data[0];
    const actualColumns = Object.keys(firstRow);
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));

    if (missingColumns.length > 0) {
      return {
        success: false,
        error: `Columnas faltantes: ${missingColumns.join(', ')}`
      };
    }

    // Procesar datos
    const result = processConversationData(data);
    const statistics = generateStatistics(result, data.length);

    return {
      success: true,
      data: result.panels,
      allDatesFound: result.allDatesFound,
      hasDataToday: result.hasDataToday,
      today: result.today,
      statistics: statistics,
      total_rows: data.length
    };
  } catch (error) {
    console.error('Error procesando CSV:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
