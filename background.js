console.log('✅ BACKGROUND.JS CARGADO');

// LISTENER - ULTRA SIMPLE
chrome.runtime.onMessage.addListener((req, sender, send) => {
    console.log('📨 MENSAJE RECIBIDO:', req);
    send({ pong: true, type: req.type });
    return true;
});

console.log('✅ LISTENER REGISTRADO');
