/**
 * POPUP MONITOR EN VIVO
 * Actualiza automáticamente cada 5 minutos
 */

let monitorInterval = null;
let isMonitoring = false;
let lastTabId = null;

// Actualizar hora de última actualización
function updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR', { hour12: false });
    document.getElementById('lastUpdate').textContent = timeStr;
}

// Mostrar estado
function showStatus(message, type = 'info') {
    const statusBox = document.getElementById('statusBox');
    if (statusBox) {
        statusBox.textContent = message;
        statusBox.className = `status-box show ${type}`;
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Ejecutar ciclo de descarga y actualización
async function executeMonitorCycle() {
    try {
        console.log('\n🔄 [CICLO MONITOR] Iniciando descarga...');
        showStatus('⏳ Descargando datos...', 'info');
        
        // Buscar pestaña de WhaTicket
        const whaticketTabs = await chrome.tabs.query({url: '*://*.whaticket.com/*'});
        
        if (whaticketTabs.length === 0) {
            throw new Error('❌ WhaTicket no está abierto');
        }
        
        const tabId = whaticketTabs[0].id;
        lastTabId = tabId;
        
        // Inyectar content script
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js']
            });
        } catch (e) {
            console.log('⚠️ Content script ya inyectado:', e.message);
        }
        
        await new Promise(r => setTimeout(r, 500));
        
        // Descargar y procesar
        const response = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Timeout en descarga (60s)'));
            }, 60000);
            
            chrome.tabs.sendMessage(tabId, { action: 'downloadCSV' }, (resp) => {
                clearTimeout(timer);
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(resp);
                }
            });
        });
        
        if (!response || !response.csvData) {
            throw new Error('CSV vacío o inválido');
        }
        
        // Mostrar resultados
        if (response.processedData && response.processedData.success) {
            showResults(response.processedData);
            updateLastUpdate();
            
            const stats = response.processedData.statistics;
            showStatus(`✅ Actualizado: ${stats.total_conversaciones} msgs, ${stats.total_cargas} cargas`, 'success');
            
            console.log('✅ [CICLO MONITOR] Completado exitosamente');
        } else {
            throw new Error('Error procesando datos');
        }
        
    } catch (error) {
        console.error('❌ [CICLO MONITOR] Error:', error.message);
        showStatus(`⚠️ ${error.message}`, 'error');
    }
}

// Iniciar monitoreo
function startMonitoring() {
    if (isMonitoring) return;
    
    console.log('🚀 Iniciando monitoreo en vivo...');
    isMonitoring = true;
    
    const btnToggle = document.getElementById('btnToggle');
    btnToggle.textContent = '⏹️ Detener Monitoreo';
    btnToggle.style.background = 'linear-gradient(135deg, #E85D2D 0%, #C1401B 100%)';
    
    showStatus('🟢 Monitoreo iniciado - Primera actualización en 2 segundos...', 'info');
    
    // Primera ejecución inmediata
    setTimeout(executeMonitorCycle, 2000);
    
    // Luego cada 5 minutos
    monitorInterval = setInterval(executeMonitorCycle, 5 * 60 * 1000);
}

// Detener monitoreo
function stopMonitoring() {
    if (!isMonitoring) return;
    
    console.log('🛑 Deteniendo monitoreo...');
    isMonitoring = false;
    
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
    
    const btnToggle = document.getElementById('btnToggle');
    btnToggle.textContent = '▶️ Iniciar Monitoreo';
    btnToggle.style.background = 'linear-gradient(135deg, #FFB84D 0%, #FF8C42 100%)';
    
    showStatus('🔴 Monitoreo detenido', 'error');
}

// Mostrar resultados en tabla
function showResults(result) {
    document.getElementById('resultDate').textContent = result.today;
    document.getElementById('resultTotal').textContent = result.statistics.total_conversaciones;
    document.getElementById('resultPanels').textContent = result.statistics.total_paneles;
    document.getElementById('resultCharges').textContent = result.statistics.total_cargas;
    
    const panelsTable = document.getElementById('panelsTable');
    if (!panelsTable) return;
    
    if (!result.data || result.data.length === 0) {
        panelsTable.innerHTML = '<div style="text-align: center; color: #999; padding: 10px;">❌ Sin datos para hoy</div>';
        document.getElementById('resultsDisplay').classList.add('show');
        return;
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<thead style="background: #FFE6D5; font-weight: bold; position: sticky; top: 0;">';
    html += '<tr style="border-bottom: 2px solid #FFCBA4;">';
    html += '<th style="padding: 8px; text-align: left; font-size: 11px;">Panel</th>';
    html += '<th style="padding: 8px; text-align: center; font-size: 11px;">Msgs</th>';
    html += '<th style="padding: 8px; text-align: center; font-size: 11px;">Cargas</th>';
    html += '<th style="padding: 8px; text-align: center; font-size: 11px;">%</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    result.data.forEach(panel => {
        const porcentajeNum = parseFloat(panel.porcentaje_carga);
        const bgColor = porcentajeNum >= 50 ? '#E8F5E9' : porcentajeNum >= 20 ? '#FFF9C4' : '#FFEBEE';
        const textColor = porcentajeNum >= 50 ? '#2E7D32' : porcentajeNum >= 20 ? '#F57F17' : '#C62828';
        
        html += `<tr style="border-bottom: 1px solid #FFCBA4; background: ${bgColor};">`;
        html += `<td style="padding: 8px; font-weight: 500; color: #2C1810; font-size: 12px; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${panel.panel}</td>`;
        html += `<td style="padding: 8px; text-align: center; color: #2C1810; font-size: 12px;">${panel.total_mensajes_hoy}</td>`;
        html += `<td style="padding: 8px; text-align: center; color: #2C1810; font-size: 12px;">${panel.cargas_hoy}</td>`;
        html += `<td style="padding: 8px; text-align: center; color: ${textColor}; font-weight: bold; font-size: 12px;">${panel.porcentaje_carga}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody>';
    html += '</table>';
    
    panelsTable.innerHTML = html;
    document.getElementById('resultsDisplay').classList.add('show');
}

// Inicializar popup
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Popup Monitor inicializado');
    
    const btnToggle = document.getElementById('btnToggle');
    
    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            if (isMonitoring) {
                stopMonitoring();
            } else {
                startMonitoring();
            }
        });
    }
    
    // Cargar estado guardado
    chrome.storage.local.get('monitoringState', (data) => {
        if (data.monitoringState === true) {
            console.log('📌 Reanudando monitoreo guardado...');
            startMonitoring();
        }
    });
});

// Guardar estado cuando se cierra el popup
window.addEventListener('beforeunload', () => {
    chrome.storage.local.set({ monitoringState: isMonitoring });
});

