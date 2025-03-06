// Connect to Socket.IO server
const socket = io();

// Game elements
const gameSetup = document.getElementById('game-setup');
const gameBoard = document.getElementById('game-board');
const roundResultOverlay = document.getElementById('round-result-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');

// Setup form elements
const team1ModelSelect = document.getElementById('team1-model');
const team2ModelSelect = document.getElementById('team2-model');
const startGameBtn = document.getElementById('start-game-btn');

// Game board elements
const currentRoundDisplay = document.getElementById('current-round');
const timerDisplay = document.getElementById('timer');
const activeTeamDisplay = document.getElementById('active-team');
const currentWordDisplay = document.getElementById('current-word-display');
const currentWordValue = document.getElementById('current-word');
const team1ScoreDisplay = document.getElementById('team1-score');
const team2ScoreDisplay = document.getElementById('team2-score');
const svgDisplay = document.getElementById('svg-display');
const guessesList = document.getElementById('guesses-list');
const guessInput = document.getElementById('guess-input');
const submitGuessBtn = document.getElementById('submit-guess-btn');

// Round result elements
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const secretWordDisplay = document.getElementById('secret-word');
const nextRoundBtn = document.getElementById('next-round-btn');

// Game over elements
const finalTeam1ScoreDisplay = document.getElementById('final-team1-score');
const finalTeam2ScoreDisplay = document.getElementById('final-team2-score');
const winningTeamDisplay = document.getElementById('winning-team');
const newGameBtn = document.getElementById('new-game-btn');

// Game state
let gameState = {
  gameId: null,
  team1Model: null,
  team2Model: null,
  team1Score: 0,
  team2Score: 0,
  currentRound: 1,
  timeRemaining: 60,
  timerInterval: null,
  guesses: []
};

// Event listeners
startGameBtn.addEventListener('click', startGame);
submitGuessBtn.addEventListener('click', submitGuess);
guessInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitGuess();
  }
});
nextRoundBtn.addEventListener('click', startNextRound);
newGameBtn.addEventListener('click', resetGame);

// Socket event listeners
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
});

socket.on('game_created', handleGameCreated);
socket.on('illustration_update', handleIllustrationUpdate);
socket.on('new_guess', handleNewGuess);
socket.on('correct_guess', handleCorrectGuess);
socket.on('time_up', handleTimeUp);
socket.on('new_round', handleNewRound);
socket.on('game_over', handleGameOver);
socket.on('llm_guess', handleLLMGuess);
socket.on('game_data', handleGameData);
socket.on('error', handleError);

// Functions

/**
 * Starts a new game
 */
function startGame() {
  const team1Model = team1ModelSelect.value;
  const team2Model = team2ModelSelect.value;
  
  // Emit the create_game event to the server
  socket.emit('create_game', {
    team1Model,
    team2Model
  });
  
  // Update local game state
  gameState.team1Model = team1Model;
  gameState.team2Model = team2Model;
  gameState.team1Score = 0;
  gameState.team2Score = 0;
  gameState.currentRound = 1;
  
  // Update UI
  team1ScoreDisplay.textContent = '0';
  team2ScoreDisplay.textContent = '0';
  currentRoundDisplay.textContent = '1/10';
  
  // Update team names to include the model info
  document.querySelectorAll('.team-name')[0].textContent = `Team 1 (${getModelDisplayName(team1Model)})`;
  document.querySelectorAll('.team-name')[1].textContent = `Team 2 (${getModelDisplayName(team2Model)})`;
  
  // Show the game board and hide the setup
  gameSetup.style.display = 'none';
  gameBoard.style.display = 'grid';
  
  // Update the game interface based on active team
  updateGameInterface();
}

/**
 * Handles the game_created event from the server
 * @param {Object} data The event data
 */
function handleGameCreated(data) {
  gameState.gameId = data.gameId;
  console.log('Game created:', data);
  
  // Set active team to Team 1 at start
  activeTeamDisplay.textContent = 'Team 1';
  
  // Immediately request game data for human players (needed to see the word)
  if (gameState.team1Model === 'human') {
    console.log('Requesting game data for human player on Team 1');
    socket.emit('get_game_data', { gameId: gameState.gameId });
    currentWordDisplay.style.display = 'block';
  }
  
  // Start the timer
  startTimer();
  
  // Update UI based on active team
  updateGameInterface();
}

/**
 * Handles game data received from the server
 * @param {Object} data The game data
 */
function handleGameData(data) {
  // Update the current word display when receiving game data
  if (data.secretWord) {
    currentWordValue.textContent = data.secretWord;
    console.log('Updated current word display:', data.secretWord);
  }
}

/**
 * Starts a timer countdown from 60 seconds
 */
function startTimer() {
  // Clear any existing timer
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
  }
  
  // Reset time to 60 seconds
  gameState.timeRemaining = 60;
  timerDisplay.textContent = gameState.timeRemaining;
  
  // Start the countdown
  gameState.timerInterval = setInterval(() => {
    gameState.timeRemaining--;
    timerDisplay.textContent = gameState.timeRemaining;
    
    // Update the server about the time remaining
    socket.emit('update_timer', {
      gameId: gameState.gameId,
      timeRemaining: gameState.timeRemaining
    });
    
    // If time runs out, stop the timer
    if (gameState.timeRemaining <= 0) {
      clearInterval(gameState.timerInterval);
    }
  }, 1000);
}

/**
 * Submits a guess to the server
 */
function submitGuess() {
  const guess = guessInput.value.trim();
  
  if (guess === '') {
    return; // Don't submit empty guesses
  }
  
  // Send the guess to the server
  socket.emit('submit_guess', {
    gameId: gameState.gameId,
    guess
  });
  
  // Clear the input field
  guessInput.value = '';
}

/**
 * Handles receiving a new SVG illustration from the server
 * @param {Object} data The event data containing the SVG and guesses
 */
function handleIllustrationUpdate(data) {
  // Display the SVG
  svgDisplay.innerHTML = data.svg;
  
  // Update guesses list
  updateGuessesList(data.guesses);
}

/**
 * Updates the guesses list in the UI
 * @param {Array} guesses The array of guesses
 */
function updateGuessesList(guesses) {
  // Clear the current list
  guessesList.innerHTML = '';
  
  // Add each guess to the list
  guesses.forEach(guess => {
    const guessItem = document.createElement('div');
    guessItem.className = 'guess-item';
    
    // Add the guess text
    const guessText = document.createElement('div');
    guessText.className = 'guess-text';
    guessText.textContent = guess;
    guessItem.appendChild(guessText);
    
    // Add a timestamp
    const guessTime = document.createElement('div');
    guessTime.className = 'guess-time';
    guessTime.textContent = new Date().toLocaleTimeString();
    guessItem.appendChild(guessTime);
    
    // Add to the list and scroll to bottom
    guessesList.appendChild(guessItem);
    guessesList.scrollTop = guessesList.scrollHeight;
  });
  
  // Update game state
  gameState.guesses = guesses;
}

/**
 * Handles a new guess event from the server
 * @param {Object} data The event data
 */
function handleNewGuess(data) {
  updateGuessesList(data.guesses);
}

/**
 * Handles an LLM-generated guess from the server
 * @param {Object} data The event data
 */
function handleLLMGuess(data) {
  // Display the guess in the input field and then submit it
  guessInput.value = data.guess;
  submitGuess();
}

/**
 * Handles a correct guess event from the server
 * @param {Object} data The event data
 */
function handleCorrectGuess(data) {
  // Stop the timer
  clearInterval(gameState.timerInterval);
  
  // Update scores
  gameState.team1Score = data.team1Score;
  gameState.team2Score = data.team2Score;
  team1ScoreDisplay.textContent = data.team1Score;
  team2ScoreDisplay.textContent = data.team2Score;
  
  // Hide current word display
  currentWordDisplay.style.display = 'none';
  
  // Show the round result overlay
  resultTitle.textContent = 'Correct Guess!';
  
  // Use the scoring team information if available
  const scoringTeam = data.scoringTeam ? `Team ${data.scoringTeam}` : activeTeamDisplay.textContent;
  resultMessage.textContent = `${scoringTeam} guessed correctly with ${gameState.timeRemaining} seconds remaining.`;
  
  secretWordDisplay.textContent = data.secretWord;
  roundResultOverlay.style.display = 'flex';
}

/**
 * Handles a time up event from the server
 * @param {Object} data The event data
 */
function handleTimeUp(data) {
  // Stop the timer
  clearInterval(gameState.timerInterval);
  
  // Hide current word display
  currentWordDisplay.style.display = 'none';
  
  // Show the round result overlay
  resultTitle.textContent = 'Time\'s Up!';
  resultMessage.textContent = `${activeTeamDisplay.textContent} ran out of time.`;
  secretWordDisplay.textContent = data.secretWord;
  roundResultOverlay.style.display = 'flex';
}

/**
 * Handles a new round event from the server
 * @param {Object} data The event data
 */
function handleNewRound(data) {
  // Update game state
  gameState.currentRound = data.round;
  gameState.team1Score = data.team1Score;
  gameState.team2Score = data.team2Score;
  
  // Update UI
  currentRoundDisplay.textContent = `${data.round}/10`;
  team1ScoreDisplay.textContent = data.team1Score;
  team2ScoreDisplay.textContent = data.team2Score;
  
  // Use the direct activeTeam value if available, otherwise fallback to role logic
  if (data.activeTeam) {
    activeTeamDisplay.textContent = `Team ${data.activeTeam}`;
  } else {
    // Fallback for backward compatibility
    const team1IsIllustrator = data.team1Role === 'illustrator';
    activeTeamDisplay.textContent = team1IsIllustrator ? 'Team 1' : 'Team 2';
  }
  
  // Clear the guesses list and SVG display
  guessesList.innerHTML = '';
  svgDisplay.innerHTML = '';
  
  // Hide the round result overlay
  roundResultOverlay.style.display = 'none';
  
  // Update game interface for the new active team
  updateGameInterface();
  
  // Immediately request game data for human players (needed to see the word)
  if (gameState.gameId) {
    // Check if active team is human
    const isTeam1Active = activeTeamDisplay.textContent.trim() === 'Team 1';
    const team1IsHuman = gameState.team1Model === 'human';
    const team2IsHuman = gameState.team2Model === 'human';
    const activeTeamIsHuman = isTeam1Active ? team1IsHuman : team2IsHuman;
    
    if (activeTeamIsHuman) {
      console.log('Requesting game data for human player');
      socket.emit('get_game_data', { gameId: gameState.gameId });
      currentWordDisplay.style.display = 'block';
    }
  }
  
  // Start the timer for the new round
  startTimer();
}

/**
 * Handles a game over event from the server
 * @param {Object} data The event data
 */
function handleGameOver(data) {
  // Stop the timer
  clearInterval(gameState.timerInterval);
  
  // Update scores
  gameState.team1Score = data.team1Score;
  gameState.team2Score = data.team2Score;
  
  // Update game over overlay
  finalTeam1ScoreDisplay.textContent = data.team1Score;
  finalTeam2ScoreDisplay.textContent = data.team2Score;
  
  // Determine winner text
  if (data.team1Score > data.team2Score) {
    winningTeamDisplay.textContent = 'Team 1 Wins!';
  } else if (data.team2Score > data.team1Score) {
    winningTeamDisplay.textContent = 'Team 2 Wins!';
  } else {
    winningTeamDisplay.textContent = 'It\'s a Tie!';
  }
  
  // Show game over overlay
  gameOverOverlay.style.display = 'flex';
}

/**
 * Handles error events from the server
 * @param {Object} data The error data
 */
function handleError(data) {
  console.error('Server error:', data.message);
  // Could add a toast notification here
}

/**
 * Starts the next round
 */
function startNextRound() {
  // Hide the round result overlay
  roundResultOverlay.style.display = 'none';
}

/**
 * Resets the game to the setup screen
 */
function resetGame() {
  // Hide game board and overlays
  gameBoard.style.display = 'none';
  gameOverOverlay.style.display = 'none';
  
  // Show game setup
  gameSetup.style.display = 'block';
  
  // Clear game state
  gameState = {
    gameId: null,
    team1Model: null,
    team2Model: null,
    team1Score: 0,
    team2Score: 0,
    currentRound: 1,
    timeRemaining: 60,
    timerInterval: null,
    guesses: []
  };
  
  // Clear UI elements
  svgDisplay.innerHTML = '';
  guessesList.innerHTML = '';
}

/**
 * Utility function to capitalize the first letter of a string
 * @param {string} string The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Get a display name for a model
 * @param {string} modelId The model ID
 * @returns {string} A human-readable model name
 */
function getModelDisplayName(modelId) {
  if (modelId === 'human') return 'Human';
  if (modelId === 'claude-3-7-sonnet-20250219') return 'Claude 3.7';
  if (modelId === 'gpt-4o') return 'GPT-4o';
  return modelId;
}

/**
 * Updates the game interface based on which team is active
 */
function updateGameInterface() {
  const guessInputContainer = document.querySelector('.guess-input-container');
  if (!guessInputContainer) return; // Exit if element doesn't exist yet
  
  // Determine which teams are human players
  const team1IsHuman = gameState.team1Model === 'human';
  const team2IsHuman = gameState.team2Model === 'human';
  
  if (!team1IsHuman && !team2IsHuman) {
    // If no human players, hide input and show both teams as AI
    guessInputContainer.style.display = 'none';
    currentWordDisplay.style.display = 'none';
    return;
  }
  
  // Determine which team is active
  const isTeam1Active = activeTeamDisplay.textContent.trim() === 'Team 1';
  const activeTeamIsHuman = isTeam1Active ? team1IsHuman : team2IsHuman;
  
  // Only show guess input for human players when their team is active
  guessInputContainer.style.display = activeTeamIsHuman ? 'flex' : 'none';
  
  // Display the current word when it's a human player's turn
  if (activeTeamIsHuman && gameState.gameId) {
    console.log('Requesting game data for word display');
    // Request the current game data from the server
    socket.emit('get_game_data', { gameId: gameState.gameId });
    currentWordDisplay.style.display = 'block';
  } else {
    console.log('Hiding word display');
    currentWordDisplay.style.display = 'none';
  }
}