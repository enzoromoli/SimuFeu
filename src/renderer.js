// Écoute les messages venant du worker engine
window.engine.onMessage((msg) => {
  console.log('[renderer] message from engine:', msg);
});

// Exemple : envoyer un message au worker au démarrage
window.engine.send({ type: 'init' });
