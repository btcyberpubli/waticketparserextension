/**
 * CSV Parser - Lógica de procesamiento 100% en el navegador
 * Replica la lógica del server.js para procesar conversaciones
 */

// Helper: Obtener fecha de HOY en zona horaria de Argentina (UTC-3)
// El CSV ya viene con fechas en UTC-3, así que esta función
// convierte la fecha actual (UTC) a UTC-3 para comparación
function getArgentinaDate(dateObj = null) {
  let date;
  
  if (dateObj) {
    // Si se pasa una fecha en UTC, restar 3 horas para Argentina
    const offsetMs = 3 * 60 * 60 * 1000;
    date = new Date(dateObj.getTime() - offsetMs);
  } else {
    // Obtener HOY en Argentina (UTC-3)
    // JavaScript da Date en UTC, restar 3 horas
    const utcNow = new Date();
    const offsetMs = 3 * 60 * 60 * 1000;
    date = new Date(utcNow.getTime() - offsetMs);
  }
  
  return date.toISOString().split('T')[0]; // Retorna YYYY-MM-DD
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
 * Convierte CSV string a array de objetos
 */
function parseCSVToArray(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // Saltar líneas vacías
    
    const obj = {};
    const parts = line.split(',');
    
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = parts[j] ? parts[j].trim() : '';
    }
    
    data.push(obj);
  }
  
  return data;
}

/**
 * Procesa los datos del CSV - SOLO datos de HOY
 */
function processConversationData(rows) {
  const today = getArgentinaDate();
  const dataToday = {};
  const allDatesFound = new Set();
  
  let totalRowsWithToday = 0;
  let totalRowsProcessed = 0;

  rows.forEach((row) => {
    totalRowsProcessed++;
    
    // Intentar diferentes campos de fecha
    const createdAtStr = row.firstSentMessageAt || row.createdAt || '';
    const dateKey = parseCSVDate(createdAtStr);
    
    if (!dateKey) {
      return;
    }

    allDatesFound.add(dateKey);
    
    // SOLO procesar datos de HOY
    if (dateKey !== today) {
      return;
    }
    
    totalRowsWithToday++;
    
    const department = (row.department || 'SIN_PANEL').trim();
    const connection = (row.connection || 'SIN_CAMPAÑA').trim();
    const tags = (row.conversationTags || '').trim();
    
    const hasTag = tags && tags !== '' && tags !== 'nan';

    // Inicializar panel para hoy si no existe
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

    // Incrementar mensajes
    dataToday[department].total_mensajes_hoy += 1;

    // Inicializar campaña si no existe
    if (!dataToday[department].campañas[connection]) {
      dataToday[department].campañas[connection] = {
        mensajes: 0,
        cargas: 0
      };
    }

    dataToday[department].campañas[connection].mensajes += 1;

    // Contar carga si tiene tags
    if (hasTag) {
      dataToday[department].cargas_hoy += 1;
      dataToday[department].campañas[connection].cargas += 1;
    }
  });
  
  // Convertir a array y calcular porcentajes
  const panelsToday = Object.values(dataToday).map((panel) => {
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

  // Ordenar paneles por total_mensajes_hoy descendente
  panelsToday.sort((a, b) => b.total_mensajes_hoy - a.total_mensajes_hoy);

  // Asignar IDs secuenciales
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
function generateStatistics(result) {
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
 * Función principal que procesa CSV y retorna resultado
 */
function processCSV(csvText) {
  try {
    console.log('🔄 Procesando CSV en el navegador...');
    
    // Convertir CSV a array de objetos
    const rows = parseCSVToArray(csvText);
    console.log(`   Total filas: ${rows.length}`);
    
    if (rows.length === 0) {
      return {
        success: false,
        error: 'El CSV no contiene datos válidos'
      };
    }

    // Procesar datos
    const result = processConversationData(rows);
    const statistics = generateStatistics(result);
    
    console.log(`✅ CSV procesado: ${result.panels.length} paneles, ${statistics.total_conversaciones} mensajes`);
    
    return {
      success: true,
      data: result.panels,
      allDatesFound: result.allDatesFound,
      hasDataToday: result.hasDataToday,
      today: result.today,
      statistics: statistics,
      total_rows: rows.length
    };
  } catch (error) {
    console.error('❌ Error procesando CSV:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
