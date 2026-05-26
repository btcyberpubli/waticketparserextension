/**
 * Service Worker para la extensión
 * Maneja el ciclo de vida y eventos globales
 */

// Escuchar instalación
chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ Extensión WhaTicket Parser instalada');
    
    // Establecer valores por defecto
    chrome.storage.local.get(['serverUrl'], (result) => {
        if (!result.serverUrl) {
            chrome.storage.local.set({ 
                serverUrl: 'http://localhost:5000'
            });
        }
    });
});

// Escuchar mensajes desde content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'log') {
        console.log('Content:', request.message);
        sendResponse({ status: 'logged' });
    }
});

console.log('✅ Service Worker de WhaTicket Parser cargado');
