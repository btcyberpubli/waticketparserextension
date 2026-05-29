console.log('✅ BACKGROUND.JS CARGADO');

// Storage para CSV capturado
let csvStorage = {
    csv: null,
    source: null,
    timestamp: null
};

// Storage para resultados (para pasar a results.html)
let lastResults = {
    csvData: null,
    processedResult: null
};

// ID de la ventana de resultados (si está abierta)
let resultsTabId = null;

// LISTENER - Manejo de mensajes
chrome.runtime.onMessage.addListener((req, sender, send) => {
    console.log('📨 MENSAJE RECIBIDO - Action:', req.action, '| Type:', req.type);
    
    // Manejar apertura de ventana de resultados
    if (req.action === 'openResultsWindow') {
        console.log('🪟 Abriendo ventana de resultados...');
        lastResults = {
            csvData: req.csvData,
            processedResult: req.processedResult
        };
        
        // Verificar si ya existe la pestaña de resultados
        if (resultsTabId) {
            // Actualizar pestaña existente
            chrome.tabs.update(resultsTabId, { active: true }, (tab) => {
                if (chrome.runtime.lastError) {
                    // La pestaña fue cerrada, abrir una nueva
                    console.log('📝 Pestaña anterior cerrada, abriendo nueva...');
                    resultsTabId = null;
                    chrome.tabs.create({
                        url: chrome.runtime.getURL('results.html'),
                        active: true
                    }, (tab) => {
                        resultsTabId = tab.id;
                        console.log('✅ Nueva ventana de resultados creada:', tab.id);
                        send({ success: true, tabId: tab.id });
                    });
                } else {
                    // Enviar datos a la pestaña abierta
                    console.log('📝 Actualizando pestaña existente:', resultsTabId);
                    chrome.tabs.sendMessage(resultsTabId, {
                        action: 'updateResults',
                        csvData: req.csvData,
                        processedResult: req.processedResult
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('⚠️ Error enviando datos:', chrome.runtime.lastError.message);
                        } else {
                            console.log('✅ Datos enviados a la ventana de resultados');
                        }
                    });
                    send({ success: true, tabId: resultsTabId, updated: true });
                }
            });
        } else {
            // Abrir nueva pestaña
            chrome.tabs.create({
                url: chrome.runtime.getURL('results.html'),
                active: true
            }, (tab) => {
                resultsTabId = tab.id;
                console.log('✅ Ventana de resultados creada:', tab.id);
                send({ success: true, tabId: tab.id });
            });
        }
        return true;
    }
    
    // Manejar obtención de resultados guardados
    if (req.action === 'getStoredResults') {
        console.log('📤 Enviando resultados guardados');
        send(lastResults);
        return true;
    }
    
    // Manejar action: storeCSV (desde content.js)
    if (req.action === 'storeCSV') {
        csvStorage = {
            csv: req.csv,
            source: req.source,
            timestamp: Date.now()
        };
        console.log('✅ CSV almacenado en background.js:');
        console.log('   Tamaño:', csvStorage.csv?.length, 'chars');
        console.log('   Fuente:', csvStorage.source);
        console.log('   Timestamp:', new Date(csvStorage.timestamp).toLocaleString());
        send({ success: true, message: 'CSV almacenado correctamente' });
        return true;
    }
    
    // Manejar type (compatibilidad con código anterior)
    switch(req.type) {
        case 'STORE_CSV':
            csvStorage = {
                csv: req.csv,
                source: req.source,
                timestamp: Date.now()
            };
            console.log('✅ CSV almacenado en storage:', csvStorage.csv?.length, 'bytes');
            send({ success: true });
            break;
            
        case 'GET_CSV_FROM_STORAGE':
            console.log('📤 Enviando CSV del storage:', csvStorage.csv?.length, 'bytes');
            send({ 
                csv: csvStorage.csv,
                source: csvStorage.source,
                ready: !!csvStorage.csv
            });
            break;
            
        case 'CLEAR_CSV_STORAGE':
            csvStorage = { csv: null, source: null, timestamp: null };
            console.log('🧹 Storage limpiado');
            send({ success: true });
            break;
            
        default:
            send({ pong: true, type: req.type });
    }
    
    return true;
});

console.log('✅ LISTENER REGISTRADO');
