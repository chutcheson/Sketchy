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
const team1RoleDisplay = document.getElementById('team1-role');
const team2RoleDisplay = document.getElementById('team2-role');
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
  
  // Show the game board and hide the setup
  gameSetup.style.display = 'none';
  gameBoard.style.display = 'grid';
}

/**
 * Handles the game_created event from the server
 * @param {Object} data The event data
 */
function handleGameCreated(data) {
  gameState.gameId = data.gameId;
  console.log('Game created:', data);
  
  // Start the timer
  startTimer();
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
  
  // Show the round result overlay
  resultTitle.textContent = 'Correct Guess!';
  resultMessage.textContent = `The word was guessed correctly with ${gameState.timeRemaining} seconds remaining.`;
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
  
  // Show the round result overlay
  resultTitle.textContent = 'Time\'s Up!';
  resultMessage.textContent = 'The word was not guessed in time.';
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
  team1RoleDisplay.textContent = capitalizeFirstLetter(data.team1Role);
  team2RoleDisplay.textContent = capitalizeFirstLetter(data.team2Role);
  
  // Clear the guesses list and SVG display
  guessesList.innerHTML = '';
  svgDisplay.innerHTML = '';
  
  // Hide the round result overlay
  roundResultOverlay.style.display = 'none';
  
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