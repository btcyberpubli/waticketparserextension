console.log('✅ Content script cargado');

// Verificar que los módulos están cargados
console.log('🔍 Verificando módulos disponibles:');
console.log('   - csvToJson:', typeof csvToJson === 'function' ? '✅' : '❌');
console.log('   - procesarDatosHoy:', typeof procesarDatosHoy === 'function' ? '✅' : '❌');

// 1. Inyectar el script 'injected.js' de manera segura en la página
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = function() {
    console.log('✅ injected.js inyectado correctamente');
    this.remove();
};
script.onerror = function() {
    console.error('❌ Error inyectando injected.js');
};
(document.head || document.documentElement).appendChild(script);

// 2. Escuchar el evento personalizado cuando el interceptor capture el CSV
window.addEventListener('WHATICKET_CSV_CAPTURED', function(event) {
    const csvData = event.detail?.csv;
    const source = event.detail?.source;
    const size = event.detail?.size;

    if (csvData) {
        console.log('\n✅ EVENTO RECIBIDO DESDE INJECTED.JS:');
        console.log('   Tipo: WHATICKET_CSV_CAPTURED');
        console.log('   Tamaño:', size, 'chars');
        console.log('   Fuente:', source);
        console.log('   Primeros 150 chars:', csvData.substring(0, 150));
        
        // Guardar en variable global para debug
        window.__receivedCSV = csvData;
        console.log('   ✅ Guardado en window.__receivedCSV para debug\n');
        
        // Enviar el CSV capturado a background.js para almacenarlo
        console.log('📤 Enviando CSV a background.js...');
        try {
            chrome.runtime.sendMessage({
                action: "storeCSV",
                csv: csvData,
                source: source,
                size: size
            }, function(response) {
                if (response?.success) {
                    console.log('✅ CSV almacenado en background.js:', response);
                } else {
                    console.error('❌ Error almacenando CSV:', response);
                }
            });
        } catch (error) {
            console.error('⚠️ Error enviando a background.js:', error.message);
        }
    }
});

// Escuchar mensajes desde results.html
window.addEventListener('message', function(event) {
    if (event.data.type === 'DISPLAY_RESULTS') {
        console.log('📊 Datos recibidos en results.html');
    }
});

console.log('📍 Listeners configurados - Esperando descargas de CSV...\n');

console.log('✅ Content script LISTO\n');

// ============================================
// ESCUCHAR MENSAJES DEL POPUP
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Petición:', request.action);
    
    if (request.action === 'downloadCSV') {
        iniciarDescargaCSV(sendResponse);
        return true; // Indica que usaremos sendResponse de forma asincrónica
    }
});

// ============================================
// FUNCIONES DE DESCARGA
// ============================================
function encontrarBotonExportar() {
    const todos = document.querySelectorAll('*');
    const botones = [];
    
    todos.forEach(el => {
        const texto = (el.innerText || el.textContent || '').trim();
        if (texto === 'Exportar') {
            botones.push({
                elemento: el,
                tag: el.tagName,
                clases: el.className,
                padre: el.parentElement.className
            });
        }
    });
    
    console.log('🔍 Botones "Exportar" encontrados:', botones.length);
    return botones;
}

function abrirModalExportar() {
    console.log('📋 Abriendo modal...');
    const botones = encontrarBotonExportar();
    if (botones[1]) {
        botones[1].elemento.click();
        console.log('✅ Modal abierto');
        return true;
    }
    console.error('❌ No encontré el botón');
    return false;
}

function encontrarOpcionCSV() {
    const menuItems = document.querySelectorAll('[role="menuitem"]');
    const opciones = [];
    
    menuItems.forEach((item, i) => {
        const texto = item.innerText.trim();
        if (texto === 'CSV' || texto === 'XLSX') {
            opciones.push({
                texto,
                indice: i,
                elemento: item
            });
        }
    });
    
    console.log('📊 Opciones encontradas:', opciones.length);
    opciones.forEach(opt => console.log(`  → ${opt.texto}`));
    return opciones;
}

function descargarCSV() {
    console.log('⏳ Esperando modal...');
    
    setTimeout(() => {
        const opciones = encontrarOpcionCSV();
        const csvOption = opciones.find(opt => opt.texto === 'CSV');
        
        if (csvOption) {
            console.log('✅ HACIENDO CLICK EN CSV...');
            csvOption.elemento.click();
            console.log('📥 Descarga iniciada');
        } else {
            console.error('❌ No encontré la opción CSV');
        }
    }, 1500);
}

// ============================================
// PROCESAR CSV
// ============================================
function csvToJson(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        console.error('❌ CSV sin datos');
        return [];
    }
    
    // Parser robusto que respeta comillas
    function parseCsvLine(line) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escapado: ""
                    current += '"';
                    i++;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Fin de campo
                fields.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        // Último campo
        if (current || fields.length > 0) {
            fields.push(current.trim());
        }
        
        return fields;
    }
    
    const headerFields = parseCsvLine(lines[0]);
    const headers = headerFields.map(h => h.replace(/^"|"$/g, ''));
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);
        const obj = {};
        
        for (let j = 0; j < headers.length; j++) {
            const value = fields[j] ? fields[j].replace(/^"|"$/g, '') : '';
            obj[headers[j]] = value;
        }
        
        // Incluir TODAS las filas (que tengan al menos un campo)
        if (Object.values(obj).some(v => v !== '')) data.push(obj);
    }
    
    console.log('📊 CSV convertido a JSON:', data.length, 'registros');
    return data;
}

// ============================================
// PROCESAR CSV
// ============================================
function csvToJson(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        console.error('❌ CSV sin datos');
        return [];
    }
    
    // Parser robusto que respeta comillas
    function parseCsvLine(line) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escapado: ""
                    current += '"';
                    i++;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Fin de campo
                fields.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        // Último campo
        if (current || fields.length > 0) {
            fields.push(current.trim());
        }
        
        return fields;
    }
    
    const headerFields = parseCsvLine(lines[0]);
    const headers = headerFields.map(h => h.replace(/^"|"$/g, ''));
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);
        const obj = {};
        
        for (let j = 0; j < headers.length; j++) {
            const value = fields[j] ? fields[j].replace(/^"|"$/g, '') : '';
            obj[headers[j]] = value;
        }
        
        if (Object.values(obj).some(v => v !== '')) data.push(obj);
    }
    
    console.log('📊 CSV convertido a JSON:', data.length, 'registros');
    return data;
}

// ============================================
// PROCESAR DATOS DE HOY
// ============================================
function procesarDatosHoy(rows) {
    try {
        // Obtener HOY en zona horaria Argentina (UTC-3)
        const utcNow = new Date();
        const offsetMs = 3 * 60 * 60 * 1000;
        const today = new Date(utcNow.getTime() - offsetMs).toISOString().split('T')[0];
        
        console.log('📅 Procesando datos para HOY:', today);
        console.log('📊 Total filas en CSV:', rows.length);
        
        const dataToday = {}; // Agrupar por department
        const allDatesFound = new Set();
        let totalRowsWithToday = 0;
        
        // ============ PROCESAR CADA FILA ============
        rows.forEach((row, idx) => {
            // IMPORTANTE: Usar firstSentMessageAt (no createdAt)
            const dateStr = row.firstSentMessageAt || row.createdAt || '';
            if (!dateStr) return;
            
            // Extraer fecha en formato YYYY-MM-DD
            const datePart = dateStr.split(' ')[0];
            if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return;
            
            allDatesFound.add(datePart);
            
            // SOLO procesar datos de HOY
            if (datePart !== today) return;
            
            totalRowsWithToday++;
            
            // Extraer datos principales
            const department = (row.department || 'SIN_PANEL').trim();
            const connection = (row.connection || 'SIN_CAMPAÑA').trim();
            const tags = (row.conversationTags || '').trim();
            
            // Determinar si tiene "carga" (tiene tags y no es "nan")
            const hasTag = tags && tags !== '' && tags !== 'nan';
            
            // Log de primeras 5 filas
            if (totalRowsWithToday <= 5) {
                console.log(`   Row ${totalRowsWithToday}: dept="${department}" conn="${connection}" tags="${tags}" hasTag=${hasTag}`);
            }
            
            // ============ INICIALIZAR PANEL ============
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
            
            // ============ CONTAR MENSAJES ============
            dataToday[department].total_mensajes_hoy += 1;
            
            // ============ INICIALIZAR CAMPAÑA ============
            if (!dataToday[department].campañas[connection]) {
                dataToday[department].campañas[connection] = {
                    mensajes: 0,
                    cargas: 0
                };
            }
            
            // ============ CONTAR MENSAJE EN CAMPAÑA ============
            dataToday[department].campañas[connection].mensajes += 1;
            
            // ============ CONTAR CARGAS SI TIENE TAGS ============
            if (hasTag) {
                dataToday[department].cargas_hoy += 1;
                dataToday[department].campañas[connection].cargas += 1;
            }
        });
        
        console.log(`\n🔍 Debug processConversationData:`);
        console.log(`   Total rows en CSV: ${rows.length}`);
        console.log(`   Rows con fecha HOY (${today}): ${totalRowsWithToday}`);
        console.log(`   Paneles procesados: ${Object.keys(dataToday).length}`);
        
        // ============ CONVERTIR A ARRAY Y CALCULAR PORCENTAJES ============
        const panelsToday = Object.values(dataToday).map((panel, idx) => {
            const total = panel.total_mensajes_hoy;
            const cargas = panel.cargas_hoy;
            const porcentaje = total > 0 ? ((cargas / total) * 100).toFixed(1) : '0.0';
            
            console.log(`   [${panel.panel}] Total: ${total}, Cargas: ${cargas}, %: ${porcentaje}%`);
            
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
        
        // ============ ORDENAR POR TOTAL DESCENDENTE ============
        panelsToday.sort((a, b) => b.total_mensajes_hoy - a.total_mensajes_hoy);
        
        // ============ ASIGNAR IDs SECUENCIALES ============
        panelsToday.forEach((item, idx) => {
            item.id = idx.toString();
        });
        
        // ============ GENERAR ESTADÍSTICAS ============
        const totalCampañas = new Set();
        let totalCargas = 0;
        let totalMensajes = 0;
        
        panelsToday.forEach(panel => {
            totalMensajes += panel.total_mensajes_hoy;
            totalCargas += panel.cargas_hoy;
            Object.keys(panel.campañas).forEach(camp => totalCampañas.add(camp));
        });
        
        const statistics = {
            total_conversaciones: totalMensajes,
            total_paneles: panelsToday.length,
            total_campañas: totalCampañas.size,
            total_cargas: totalCargas,
            paneles_top_3: panelsToday.slice(0, 3).map(item => ({
                panel: item.panel,
                mensajes: item.total_mensajes_hoy,
                cargas: item.cargas_hoy
            })),
            fecha_actual: today
        };
        
        console.log(`\n✅ Respuesta final:`);
        console.log(`   Total filas CSV: ${rows.length}`);
        console.log(`   Paneles encontrados: ${panelsToday.length}`);
        console.log(`   Estadísticas:`, {
            total_conversaciones: statistics.total_conversaciones,
            total_cargas: statistics.total_cargas,
            porcentaje_general: panelsToday.length > 0 ? ((totalCargas / totalMensajes) * 100).toFixed(1) + '%' : 'N/A'
        });
        
        return {
            success: true,
            data: panelsToday,
            allDatesFound: Array.from(allDatesFound).sort().reverse(),
            hasDataToday: panelsToday.length > 0,
            today: today,
            statistics: statistics,
            total_rows: rows.length
        };
        
    } catch (error) {
        console.error('❌ Error en procesarDatosHoy:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================
// FUNCIÓN PRINCIPAL - CICLO COMPLETO
// ============================================
async function iniciarDescargaCSV(sendResponse) {
    console.log('\n🚀 ===== INICIANDO CICLO COMPLETO =====\n');
    
    let timeoutId = null;
    let csvRecibido = null;
    
    try {
        console.log('✅ Interceptor de blobs inyectado y activo\n');
        
        // Setup: Escuchar CSV que llegará desde injected.js via CustomEvent
        const csvListener = (event) => {
            csvRecibido = event.detail;
            console.log('\n✅✅✅ CSV CAPTURADO EXITOSAMENTE');
            console.log('   Fuente:', csvRecibido.source);
            console.log('   Tamaño:', csvRecibido.size, 'chars');
            
            clearTimeout(timeoutId);
            procesarYEnviar(csvRecibido);
        };
        
        window.addEventListener('WHATICKET_CSV_CAPTURED', csvListener);
        
        // Setup: Timeout
        timeoutId = setTimeout(() => {
            window.removeEventListener('WHATICKET_CSV_CAPTURED', csvListener);
            
            console.error('\n❌ TIMEOUT (60 segundos)');
            console.log('\n📝 DIAGNÓSTICO:');
            console.log('   ✅ Interceptor está inyectado');
            console.log('   ❓ Pero NO se capturó ningún blob');
            console.log('   ℹ️  Posibles causas:');
            console.log('      • El CSV no se descargó');
            console.log('      • WhaTicket no usa blob URLs');
            console.log('      • La estructura del DOM cambió\n');
            
            sendResponse({ 
                error: 'Timeout: CSV no fue capturado en 60 segundos',
                hint: 'Intenta descargar el CSV manualmente para verificar'
            });
        }, 60000);
        
        // PASO 1: Abrir modal
        console.log('⏳ Abriendo modal de exportación...');
        abrirModalExportar();
        console.log('✅ Modal abierto\n');
        
        // PASO 2: Click en CSV (descarga)
        console.log('⏳ Haciendo click en CSV...');
        descargarCSV();
        console.log('✅ Click realizado');
        console.log('⏳ Esperando que se capture el blob URL...\n');
        
        async function procesarYEnviar(data) {
            window.removeEventListener('WHATICKET_CSV_CAPTURED', csvListener);
            clearTimeout(timeoutId);
            
            console.log('\n⚙️ PROCESANDO CSV...');
            
            try {
                // Paso 1: Convertir CSV string a JSON array (parser robusto)
                console.log('📥 Recibido:', data.csv.substring(0, 100) + '...');
                const jsonData = csvToJson(data.csv);
                
                if (!jsonData || jsonData.length === 0) {
                    throw new Error('CSV vacío o sin datos válidos');
                }
                
                console.log('   ✅ CSV convertido a JSON:', jsonData.length, 'registros');
                
                // Paso 2: Procesar datos de HOY
                console.log('🔄 Procesando datos...');
                const processedResult = procesarDatosHoy(jsonData);
                
                if (!processedResult.success) {
                    throw new Error(processedResult.error || 'Error procesando CSV');
                }
                
                console.log('   ✅ CSV procesado:', processedResult.data.length, 'paneles');
                console.log('   ✅ Total conversaciones:', processedResult.statistics.total_conversaciones);
                console.log('   ✅ Total cargas:', processedResult.statistics.total_cargas);
                
                // Verificar si hay datos de HOY
                if (!processedResult.hasDataToday) {
                    console.warn('\n⚠️ ADVERTENCIA: No hay datos de HOY');
                    console.log('   Fecha buscada:', processedResult.today);
                    console.log('   Fechas disponibles en CSV:', processedResult.allDatesFound.join(', '));
                }
                
                // Abrir ventana de resultados via background.js
                console.log('\n📊 Enviando datos al popup...');
                
                // Enviar resultado al popup
                sendResponse({ 
                    success: true,
                    csvData: data.csv,
                    processedData: processedResult
                });
                
                console.log('✅ Datos enviados al popup correctamente');
                
            } catch (err) {
                console.error('\n❌ Error procesando:', err.message);
                sendResponse({ 
                    success: false,
                    error: err.message
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error fatal:', error);
        sendResponse({ error: error.message });
    }
}

console.log('🚀 Content script cargado correctamente');
