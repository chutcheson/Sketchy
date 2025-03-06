const { Anthropic } = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { getRandomWord } = require('../utils/wordGenerator');

// Initialize API clients
// Read API keys from files if environment variables are not set
let anthropicApiKey = process.env.ANTHROPIC_API_KEY;
let openaiApiKey = process.env.OPENAI_API_KEY;

try {
  // If environment variables aren't set, try to read from files
  if (!anthropicApiKey) {
    const fs = require('fs');
    const path = require('path');
    const anthropicKeyPath = path.join(__dirname, '../../../anthropic_api_key.txt');
    if (fs.existsSync(anthropicKeyPath)) {
      anthropicApiKey = fs.readFileSync(anthropicKeyPath, 'utf8').trim();
    }
  }
  
  if (!openaiApiKey) {
    const fs = require('fs');
    const path = require('path');
    const openaiKeyPath = path.join(__dirname, '../../../openai_api_key.txt');
    if (fs.existsSync(openaiKeyPath)) {
      openaiApiKey = fs.readFileSync(openaiKeyPath, 'utf8').trim();
    }
  }
} catch (error) {
  console.error('Error reading API keys:', error);
}

// Initialize API clients with the keys
const anthropic = new Anthropic({
  apiKey: anthropicApiKey,
});

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Active games tracking
const activeGames = new Map();

// Shared Socket.IO instance
let ioInstance;

/**
 * Sets up socket handlers for LLM interactions
 * @param {SocketIO.Server} io The Socket.IO server instance
 * @param {SocketIO.Socket} socket The individual socket connection
 */
function setupLLMHandlers(io, socket) {
  // Store the io instance for use in other functions
  ioInstance = io;
  
  // Global handler for game data requests
  socket.on('get_game_data', (data) => {
    console.log('Received get_game_data request:', data);
    const { gameId } = data;
    const game = activeGames.get(gameId);
    if (game) {
      console.log('Sending game data to client:', {
        gameId: game.gameId,
        secretWord: game.secretWord
      });
      socket.emit('game_data', { 
        gameId: game.gameId,
        secretWord: game.secretWord,
        team1Role: game.team1.currentRole,
        team2Role: game.team2.currentRole
      });
    } else {
      console.log('Game not found for ID:', gameId);
      socket.emit('error', { message: 'Game not found' });
    }
  });
  
  // Handle game creation
  socket.on('create_game', async (data) => {
    try {
      const { team1Model, team2Model } = data;
      const gameId = Date.now().toString();
      const secretWord = getRandomWord();
      
      // Store game state with active team concept
      activeGames.set(gameId, {
        gameId,
        secretWord,
        activeTeam: 1, // Team 1 starts as active
        team1: {
          model: team1Model,
          score: 0,
          currentRole: 'illustrator' // For backward compatibility
        },
        team2: {
          model: team2Model,
          score: 0,
          currentRole: 'guesser' // For backward compatibility
        },
        round: 1,
        turnId: Date.now().toString(), // Unique ID for this turn/round
        timeRemaining: 60,
        guesses: [],
        svgImage: null,
        pendingRequests: new Set() // Track ongoing API requests
      });
      
      // Join socket to game room
      socket.join(gameId);
      
      // Emit game created event first so client can start UI setup
      ioInstance.to(gameId).emit('game_created', { 
        gameId, 
        team1Model, 
        team2Model,
        round: 1,
        turnId: activeGames.get(gameId).turnId // Include the turn ID
      });
      
      // Start the game by requesting the first SVG from the illustrator
      await generateIllustration(gameId, activeGames.get(gameId));
      
    } catch (error) {
      console.error('Error creating game:', error);
      socket.emit('error', { message: 'Failed to create game' });
    }
  });
  
  // Handle guess submission
  socket.on('submit_guess', async (data) => {
    try {
      const { gameId, guess } = data;
      const game = activeGames.get(gameId);
      
      if (!game) {
        return socket.emit('error', { message: 'Game not found' });
      }
      
      // Add the guess to the game state
      game.guesses.push(guess);
      
      // Check if the guess is correct
      if (guess.toLowerCase() === game.secretWord.toLowerCase()) {
        // Calculate score based on time remaining
        const scoreToAdd = game.timeRemaining;
        
        // Update the score for the active team
        if (game.activeTeam === 1) {
          game.team1.score += scoreToAdd;
          console.log(`Team 1 scored ${scoreToAdd} points, total: ${game.team1.score}`);
        } else {
          game.team2.score += scoreToAdd;
          console.log(`Team 2 scored ${scoreToAdd} points, total: ${game.team2.score}`);
        }
        
        // Emit correct guess event
        ioInstance.to(gameId).emit('correct_guess', {
          guess,
          secretWord: game.secretWord,
          team1Score: game.team1.score,
          team2Score: game.team2.score,
          activeTeam: game.activeTeam,
          scoringTeam: game.activeTeam
        });
        
        // Start next round or end game
        startNextRound(gameId, game);
      } else {
        // Just emit the guess to update the UI
        ioInstance.to(gameId).emit('new_guess', { 
          guess,
          guesses: game.guesses 
        });
        
        // Generate a refined illustration based on the guess
        // Only refine if this team is using an AI as illustrator
        const illustratorTeam = game.team1.currentRole === 'illustrator' ? game.team1 : game.team2;
        if (illustratorTeam.model !== 'human') {
          await refineIllustration(gameId, game, guess);
        }
      }
    } catch (error) {
      console.error('Error processing guess:', error);
      socket.emit('error', { message: 'Failed to process guess' });
    }
  });
  
  // Handle game timer update
  socket.on('update_timer', (data) => {
    const { gameId, timeRemaining } = data;
    const game = activeGames.get(gameId);
    
    if (game) {
      game.timeRemaining = timeRemaining;
      
      // If time runs out, start next round
      if (timeRemaining <= 0) {
        ioInstance.to(gameId).emit('time_up', { secretWord: game.secretWord });
        startNextRound(gameId, game);
      }
    }
  });
}

/**
 * Generates an SVG illustration based on the secret word
 * @param {string} gameId The game ID
 * @param {Object} game The game state
 */
async function generateIllustration(gameId, game) {
  try {
    // Capture the current turn ID at the start of the process
    const currentTurnId = game.turnId;
    
    // Get the active team
    const activeTeamNum = game.activeTeam;
    const activeTeam = activeTeamNum === 1 ? game.team1 : game.team2;
    const activeModel = activeTeam.model;
    
    // Log the drawing attempt
    console.log(`Generating illustration for word "${game.secretWord}" by Team ${activeTeamNum} (${activeModel}) [Turn ID: ${currentTurnId}]`);
    
    // Create a request identifier for tracking
    const requestId = `illustration-${Date.now()}`;
    game.pendingRequests.add(requestId);
    
    // Generate the SVG based on the active team's model
    let svgContent;
    
    if (activeModel.includes('claude')) {
      svgContent = await generateSvgWithAnthropic(game.secretWord);
    } else if (activeModel !== 'human') {
      svgContent = await generateSvgWithOpenAI(game.secretWord, activeModel);
    } else {
      // Human illustrator - wait for user input
      console.log(`Human player Team ${activeTeamNum} needs to illustrate "${game.secretWord}"`);
      // For now, we'll use a placeholder SVG for human players
      svgContent = `<svg width="400" height="400" viewBox="0 0 400 400">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-size="24" text-anchor="middle">Human player's turn to draw</text>
      </svg>`;
    }
    
    // Remove this request from pending
    game.pendingRequests.delete(requestId);
    
    // Verify that the turn hasn't changed while we were waiting
    if (game.turnId !== currentTurnId) {
      console.log(`Turn ID changed from ${currentTurnId} to ${game.turnId} - discarding illustration`);
      return; // Exit without updating game state or emitting event
    }
    
    // Update game state with the SVG
    game.svgImage = svgContent;
    
    // Emit the SVG to clients
    ioInstance.to(gameId).emit('illustration_update', { 
      svg: svgContent,
      guesses: game.guesses,
      turnId: currentTurnId // Include turn ID so client can validate
    });
    
    console.log(`Illustration generated successfully for "${game.secretWord}" [Turn ID: ${currentTurnId}]`);
    
    // Same team will both illustrate and guess
    if (activeModel !== 'human') {
      console.log(`Team ${activeTeamNum} (${activeModel}) will now try to guess their own drawing`);
      // Wait a moment to simulate thinking time
      setTimeout(() => {
        // Verify the turn is still active before guessing
        if (game.turnId === currentTurnId) {
          processGuessWithLLM(gameId, game, currentTurnId);
        } else {
          console.log(`Turn changed before guessing - skipping LLM guess`);
        }
      }, 2000);
    } else {
      console.log(`Team ${activeTeamNum} (Human) will guess their own drawing`);
    }
    
  } catch (error) {
    console.error('Error generating illustration:', error);
    ioInstance.to(gameId).emit('error', { message: 'Failed to generate illustration' });
  }
}

/**
 * Refines an existing SVG illustration based on guesses
 * @param {string} gameId The game ID
 * @param {Object} game The game state
 * @param {string} latestGuess The latest guess
 */
async function refineIllustration(gameId, game, latestGuess) {
  try {
    // Capture the current turn ID at the start of the process
    const currentTurnId = game.turnId;
    
    // Get the active team
    const activeTeamNum = game.activeTeam;
    const activeTeam = activeTeamNum === 1 ? game.team1 : game.team2;
    const activeModel = activeTeam.model;
    
    console.log(`Refining illustration for "${game.secretWord}" by Team ${activeTeamNum} after guess: ${latestGuess} [Turn ID: ${currentTurnId}]`);
    
    // Create a request identifier for tracking
    const requestId = `refinement-${Date.now()}`;
    game.pendingRequests.add(requestId);
    
    // Generate refined SVG based on the active team's model
    let svgContent;
    
    if (activeModel.includes('claude')) {
      svgContent = await refineSvgWithAnthropic(game.secretWord, game.svgImage, latestGuess, game.guesses);
    } else if (activeModel !== 'human') {
      svgContent = await refineSvgWithOpenAI(game.secretWord, game.svgImage, latestGuess, game.guesses, activeModel);
    } else {
      // Human player doesn't get automatic refinement
      console.log(`Human player Team ${activeTeamNum} will need to manually refine their drawing`);
      game.pendingRequests.delete(requestId);
      return; // Exit without updating SVG
    }
    
    // Remove this request from pending
    game.pendingRequests.delete(requestId);
    
    // Verify that the turn hasn't changed while we were waiting
    if (game.turnId !== currentTurnId) {
      console.log(`Turn ID changed from ${currentTurnId} to ${game.turnId} - discarding refinement`);
      return; // Exit without updating game state or emitting event
    }
    
    // Update game state with the new SVG
    game.svgImage = svgContent;
    
    // Emit the updated SVG to clients
    ioInstance.to(gameId).emit('illustration_update', { 
      svg: svgContent,
      guesses: game.guesses,
      turnId: currentTurnId // Include turn ID so client can validate
    });
    
    console.log(`Illustration refined successfully for "${game.secretWord}" [Turn ID: ${currentTurnId}]`);
    
    // Same team will continue guessing
    if (activeModel !== 'human') {
      console.log(`Team ${activeTeamNum} (${activeModel}) will try again with the refined drawing`);
      // Wait a moment to simulate thinking time
      setTimeout(() => {
        // Verify the turn is still active before guessing
        if (game.turnId === currentTurnId) {
          processGuessWithLLM(gameId, game, currentTurnId);
        } else {
          console.log(`Turn changed before guessing - skipping LLM guess`);
        }
      }, 2000);
    }
    
  } catch (error) {
    console.error('Error refining illustration:', error);
    ioInstance.to(gameId).emit('error', { message: 'Failed to refine illustration' });
  }
}

/**
 * Processes guesses using the guessing LLM
 * @param {string} gameId The game ID
 * @param {Object} game The game state
 * @param {string} turnId The turn ID to validate against
 */
async function processGuessWithLLM(gameId, game, turnId) {
  try {
    // Validate that we're still in the same turn
    if (game.turnId !== turnId) {
      console.log(`Turn ID mismatch for guess: expected ${turnId}, got ${game.turnId} - discarding guess`);
      return; // Exit without processing
    }
    
    // Get the active team
    const activeTeamNum = game.activeTeam;
    const activeTeam = activeTeamNum === 1 ? game.team1 : game.team2;
    const activeModel = activeTeam.model;
    
    // Make sure we have an SVG to analyze
    if (!game.svgImage) {
      console.error('No SVG image available for guessing');
      ioInstance.to(gameId).emit('error', { message: 'No image to analyze for guessing' });
      return;
    }
    
    console.log(`Processing guess for Team ${activeTeamNum} (${activeModel}) [Turn ID: ${turnId}]`);
    
    // Create a request identifier for tracking
    const requestId = `guess-${Date.now()}`;
    game.pendingRequests.add(requestId);
    
    // Generate guess based on the active team's model
    let guess;
    
    if (activeModel.includes('claude')) {
      guess = await generateGuessWithAnthropic(game.svgImage, game.guesses);
    } else if (activeModel !== 'human') {
      guess = await generateGuessWithOpenAI(game.svgImage, game.guesses, activeModel);
    } else {
      console.log(`Human player Team ${activeTeamNum} needs to provide a guess`);
      game.pendingRequests.delete(requestId);
      return; // Exit without making an AI guess
    }
    
    // Remove this request from pending
    game.pendingRequests.delete(requestId);
    
    // Verify that the turn hasn't changed while we were waiting
    if (game.turnId !== turnId) {
      console.log(`Turn ID changed from ${turnId} to ${game.turnId} - discarding guess`);
      return; // Exit without emitting the guess
    }
    
    console.log(`Team ${activeTeamNum} (${activeModel}) guessed: "${guess}" [Turn ID: ${turnId}]`);
    
    // Emit the guess event (this will trigger the submit_guess handler)
    ioInstance.to(gameId).emit('llm_guess', { 
      guess,
      model: activeModel,
      turnId: turnId // Include turn ID so client can validate
    });
    
  } catch (error) {
    console.error('Error generating guess:', error);
    ioInstance.to(gameId).emit('error', { message: 'Failed to generate guess' });
  }
}

/**
 * Starts the next round or ends the game
 * @param {string} gameId The game ID
 * @param {Object} game The game state
 */
function startNextRound(gameId, game) {
  // Check if we've reached the max rounds (e.g., 10 rounds)
  if (game.round >= 10) {
    // End the game
    ioInstance.to(gameId).emit('game_over', {
      team1Score: game.team1.score,
      team2Score: game.team2.score,
      winner: game.team1.score > game.team2.score ? 'team1' : 'team2'
    });
    
    // Clean up the game state
    activeGames.delete(gameId);
    return;
  }
  
  // Cancel any pending API requests from the previous round
  console.log(`Cancelling ${game.pendingRequests.size} pending requests from previous round`);
  // Just clear the set - we'll use the turnId to validate responses
  game.pendingRequests.clear();
  
  // Increment round
  game.round++;
  
  // Generate a new turn ID to invalidate any pending API responses
  game.turnId = Date.now().toString();
  
  // Switch active team
  game.activeTeam = game.activeTeam === 1 ? 2 : 1;
  
  // Keep role switching for backward compatibility
  game.team1.currentRole = game.team1.currentRole === 'illustrator' ? 'guesser' : 'illustrator';
  game.team2.currentRole = game.team2.currentRole === 'illustrator' ? 'guesser' : 'illustrator';
  
  // Get a new secret word
  game.secretWord = getRandomWord();
  
  // Reset round-specific state
  game.timeRemaining = 60;
  game.guesses = [];
  game.svgImage = null;
  
  console.log(`Starting round ${game.round} with Team ${game.activeTeam} active, word: "${game.secretWord}"`);
  
  // First, emit the new round event to clear the UI
  ioInstance.to(gameId).emit('new_round', {
    round: game.round,
    activeTeam: game.activeTeam,
    team1Role: game.team1.currentRole, // For backward compatibility 
    team2Role: game.team2.currentRole, // For backward compatibility
    team1Score: game.team1.score,
    team2Score: game.team2.score,
    turnId: game.turnId // Include the turn ID for client validation
  });
  
  // Slight delay before generating a new illustration to ensure UI is cleared
  setTimeout(() => {
    // Generate a new illustration for the new round
    generateIllustration(gameId, game);
  }, 500); // 500ms delay to ensure client has time to clear previous content
}

// LLM API integration functions

/**
 * Generates an SVG using Anthropic's Claude
 * @param {string} secretWord The word to illustrate
 * @returns {Promise<string>} The SVG content
 */
async function generateSvgWithAnthropic(secretWord) {
  const message = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 4000,
    system: `You are the Illustrator in a game of Pictionary. Your task is to create an SVG graphic that represents a secret word without using text or direct hints.
    
    The SVG should be as clear as possible for the Guesser to easily identify the word. Your goal is to help the Guesser correctly guess the word.
    
    - Create a minimalist SVG graphic representing the secret word
    - DO NOT include the word or text hinting at the word
    - Use shapes, lines, and colors to represent the concept
    - The SVG should be clean and visually appealing
    - Return ONLY the <svg> element with all necessary code, with width="400" height="400" viewBox="0 0 400 400"
    - Use creative visual metaphors
    - No explanations, just return the SVG code`,
    messages: [
      {
        role: "user",
        content: `Create an SVG illustration for the secret word: "${secretWord}". Remember, DO NOT include any text in the SVG that reveals or hints at the word.`
      }
    ],
  });
  
  // Extract the SVG content from the response
  return message.content[0].text;
}

/**
 * Refines an SVG using Anthropic's Claude based on guesses
 * @param {string} secretWord The secret word
 * @param {string} currentSvg The current SVG content
 * @param {string} latestGuess The latest guess
 * @param {string[]} allGuesses All previous guesses
 * @returns {Promise<string>} The refined SVG content
 */
async function refineSvgWithAnthropic(secretWord, currentSvg, latestGuess, allGuesses) {
  const message = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219", 
    max_tokens: 4000,
    system: `You are the Illustrator in a game of Pictionary. Your task is to refine an SVG graphic based on the guesses to help the Guesser identify the secret word.
    
    - Analyze the current SVG and the guesses made so far
    - Refine the SVG to better communicate the secret word
    - DO NOT include the word or text hinting at the word
    - If guesses are close, emphasize relevant elements
    - If guesses are far off, add new visual elements to guide the Guesser
    - Return ONLY the complete <svg> element with all necessary code, with width="400" height="400" viewBox="0 0 400 400"
    - No explanations, just return the refined SVG code`,
    messages: [
      {
        role: "user",
        content: `Here is the current SVG illustration for the secret word "${secretWord}":\n\n${currentSvg}\n\nThe latest guess was: "${latestGuess}"\n\nAll guesses so far: ${allGuesses.join(', ')}\n\nPlease refine the SVG to better communicate the secret word, without using text or direct hints.`
      }
    ],
  });
  
  // Extract the SVG content from the response
  return message.content[0].text;
}

/**
 * Generates a guess using Anthropic's Claude
 * @param {string} svgContent The SVG to interpret
 * @param {string[]} previousGuesses Previous guesses
 * @returns {Promise<string>} The guess
 */
async function generateGuessWithAnthropic(svgContent, previousGuesses) {
  const message = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 1000,
    system: `You are the Guesser in a game of Pictionary. Your task is to identify the secret word based on an SVG graphic.
    
    - Analyze the SVG carefully to identify visual patterns and metaphors
    - Consider common Pictionary categories: objects, animals, actions, etc.
    - Make your best guess based on the visual elements
    - Be creative but precise in your interpretation
    - Avoid repeating previous guesses
    - Return ONLY your guess word or short phrase, with no explanations`,
    messages: [
      {
        role: "user",
        content: `Here is an SVG illustration. What word or concept does it represent?\n\n${svgContent}\n\nPrevious guesses: ${previousGuesses.join(', ')}\n\nYour guess:`
      }
    ],
  });
  
  // Extract the guess from the response
  return message.content[0].text.trim();
}

/**
 * Generates an SVG using OpenAI's API
 * @param {string} secretWord The word to illustrate
 * @returns {Promise<string>} The SVG content
 */
async function generateSvgWithOpenAI(secretWord, model = "gpt-4o") {
  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: `You are the Illustrator in a game of Pictionary. Your task is to create an SVG graphic that represents a secret word without using text or direct hints.
    
    The SVG should be as clear as possible for the Guesser to easily identify the word. Your goal is to help the Guesser correctly guess the word.
    
    - Create a minimalist SVG graphic representing the secret word
    - DO NOT include the word or text hinting at the word
    - Use shapes, lines, and colors to represent the concept
    - The SVG should be clean and visually appealing
    - Return ONLY the <svg> element with all necessary code, with width="400" height="400" viewBox="0 0 400 400"
    - Use creative visual metaphors
    - No explanations, just return the SVG code`
      },
      {
        role: "user",
        content: `Create an SVG illustration for the secret word: "${secretWord}". Remember, DO NOT include any text in the SVG that reveals or hints at the word.`
      }
    ],
    max_tokens: 4000
  });
  
  // Extract the SVG content from the response
  return response.choices[0].message.content;
}

/**
 * Refines an SVG using OpenAI's API based on guesses
 * @param {string} secretWord The secret word
 * @param {string} currentSvg The current SVG content
 * @param {string} latestGuess The latest guess
 * @param {string[]} allGuesses All previous guesses
 * @returns {Promise<string>} The refined SVG content
 */
async function refineSvgWithOpenAI(secretWord, currentSvg, latestGuess, allGuesses, model = "gpt-4o") {
  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: `You are the Illustrator in a game of Pictionary. Your task is to refine an SVG graphic based on the guesses to help the Guesser identify the secret word.
    
    - Analyze the current SVG and the guesses made so far
    - Refine the SVG to better communicate the secret word
    - DO NOT include the word or text hinting at the word
    - If guesses are close, emphasize relevant elements
    - If guesses are far off, add new visual elements to guide the Guesser
    - Return ONLY the complete <svg> element with all necessary code, with width="400" height="400" viewBox="0 0 400 400"
    - No explanations, just return the refined SVG code`
      },
      {
        role: "user",
        content: `Here is the current SVG illustration for the secret word "${secretWord}":\n\n${currentSvg}\n\nThe latest guess was: "${latestGuess}"\n\nAll guesses so far: ${allGuesses.join(', ')}\n\nPlease refine the SVG to better communicate the secret word, without using text or direct hints.`
      }
    ],
    max_tokens: 4000
  });
  
  // Extract the SVG content from the response
  return response.choices[0].message.content;
}

/**
 * Generates a guess using OpenAI's API
 * @param {string} svgContent The SVG to interpret
 * @param {string[]} previousGuesses Previous guesses
 * @returns {Promise<string>} The guess
 */
async function generateGuessWithOpenAI(svgContent, previousGuesses, model = "gpt-4o-mini") {
  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: `You are the Guesser in a game of Pictionary. Your task is to identify the secret word based on an SVG graphic.
    
    - Analyze the SVG carefully to identify visual patterns and metaphors
    - Consider common Pictionary categories: objects, animals, actions, etc.
    - Make your best guess based on the visual elements
    - Be creative but precise in your interpretation
    - Avoid repeating previous guesses
    - Return ONLY your guess word or short phrase, with no explanations`
      },
      {
        role: "user",
        content: `Here is an SVG illustration. What word or concept does it represent?\n\n${svgContent}\n\nPrevious guesses: ${previousGuesses.join(', ')}\n\nYour guess:`
      }
    ],
    max_tokens: 50
  });
  
  // Extract the guess from the response
  return response.choices[0].message.content.trim();
}

module.exports = { setupLLMHandlers };