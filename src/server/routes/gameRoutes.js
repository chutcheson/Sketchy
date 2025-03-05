const path = require('path');
const { getRandomWord } = require('../utils/wordGenerator');

function setupGameRoutes(app) {
  // Main route - serve the game UI
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../../public/index.html'));
  });

  // API endpoint to get a random word
  app.get('/api/word', (req, res) => {
    const word = getRandomWord();
    res.json({ word });
  });

  // API endpoint to start a new game
  app.post('/api/game/start', (req, res) => {
    const { team1Model, team2Model } = req.body;
    // Start a new game session with the specified models
    const gameId = Date.now().toString();
    res.json({ 
      gameId, 
      message: 'Game started successfully',
      team1Model,
      team2Model
    });
  });
}

module.exports = { setupGameRoutes };