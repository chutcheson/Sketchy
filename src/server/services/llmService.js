const Anthropic = require('anthropic');
const OpenAI = require('openai');
const { getRandomWord } = require('../utils/wordGenerator');

// Initialize API clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Active games tracking
const activeGames = new Map();

/**
 * Sets up socket handlers for LLM interactions
 * @param {SocketIO.Server} io The Socket.IO server instance
 * @param {SocketIO.Socket} socket The individual socket connection
 */
function setupLLMHandlers(io, socket) {
  // Handle game creation
  socket.on('create_game', async (data) => {
    try {
      const { team1Model, team2Model } = data;
      const gameId = Date.now().toString();
      const secretWord = getRandomWord();
      
      // Store game state
      activeGames.set(gameId, {
        gameId,
        secretWord,
        team1: {
          model: team1Model,
          score: 0,
          currentRole: 'illustrator'
        },
        team2: {
          model: team2Model,
          score: 0,
          currentRole: 'guesser'
        },
        round: 1,
        timeRemaining: 60,
        guesses: [],
        svgImage: null
      });
      
      // Join socket to game room
      socket.join(gameId);
      
      // Start the game by requesting the first SVG from the illustrator
      await generateIllustration(gameId, activeGames.get(gameId));
      
      // Emit game created event
      io.to(gameId).emit('game_created', { 
        gameId, 
        team1Model, 
        team2Model,
        round: 1
      });
      
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
        
        // Update the score for the guessing team
        if (game.team1.currentRole === 'guesser') {
          game.team1.score += scoreToAdd;
        } else {
          game.team2.score += scoreToAdd;
        }
        
        // Emit correct guess event
        io.to(gameId).emit('correct_guess', {
          guess,
          secretWord: game.secretWord,
          team1Score: game.team1.score,
          team2Score: game.team2.score
        });
        
        // Start next round or end game
        startNextRound(gameId, game);
      } else {
        // Just emit the guess to update the UI
        io.to(gameId).emit('new_guess', { 
          guess,
          guesses: game.guesses 
        });
        
        // Generate a refined illustration based on the guess
        await refineIllustration(gameId, game, guess);
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
        io.to(gameId).emit('time_up', { secretWord: game.secretWord });
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
    // Determine which model to use as illustrator
    const illustratorTeam = game.team1.currentRole === 'illustrator' ? game.team1 : game.team2;
    const illustratorModel = illustratorTeam.model;
    
    // Generate the SVG based on the illustrator model
    let svgContent;
    
    if (illustratorModel.includes('claude')) {
      svgContent = await generateSvgWithAnthropic(game.secretWord);
    } else {
      svgContent = await generateSvgWithOpenAI(game.secretWord);
    }
    
    // Update game state with the SVG
    game.svgImage = svgContent;
    
    // Emit the SVG to clients
    io.to(gameId).emit('illustration_update', { 
      svg: svgContent,
      guesses: game.guesses 
    });
    
  } catch (error) {
    console.error('Error generating illustration:', error);
    io.to(gameId).emit('error', { message: 'Failed to generate illustration' });
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
    // Determine which model to use as illustrator
    const illustratorTeam = game.team1.currentRole === 'illustrator' ? game.team1 : game.team2;
    const illustratorModel = illustratorTeam.model;
    
    // Generate refined SVG based on the illustrator model and latest guess
    let svgContent;
    
    if (illustratorModel.includes('claude')) {
      svgContent = await refineSvgWithAnthropic(game.secretWord, game.svgImage, latestGuess, game.guesses);
    } else {
      svgContent = await refineSvgWithOpenAI(game.secretWord, game.svgImage, latestGuess, game.guesses);
    }
    
    // Update game state with the new SVG
    game.svgImage = svgContent;
    
    // Emit the updated SVG to clients
    io.to(gameId).emit('illustration_update', { 
      svg: svgContent,
      guesses: game.guesses 
    });
    
  } catch (error) {
    console.error('Error refining illustration:', error);
    io.to(gameId).emit('error', { message: 'Failed to refine illustration' });
  }
}

/**
 * Processes guesses using the guessing LLM
 * @param {string} gameId The game ID
 * @param {Object} game The game state
 */
async function processGuessWithLLM(gameId, game) {
  try {
    // Determine which model to use as guesser
    const guesserTeam = game.team1.currentRole === 'guesser' ? game.team1 : game.team2;
    const guesserModel = guesserTeam.model;
    
    // Generate guess based on the guesser model
    let guess;
    
    if (guesserModel.includes('claude')) {
      guess = await generateGuessWithAnthropic(game.svgImage, game.guesses);
    } else {
      guess = await generateGuessWithOpenAI(game.svgImage, game.guesses);
    }
    
    // Emit the guess event (this will trigger the submit_guess handler)
    io.to(gameId).emit('llm_guess', { 
      guess,
      model: guesserModel
    });
    
  } catch (error) {
    console.error('Error generating guess:', error);
    io.to(gameId).emit('error', { message: 'Failed to generate guess' });
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
    io.to(gameId).emit('game_over', {
      team1Score: game.team1.score,
      team2Score: game.team2.score,
      winner: game.team1.score > game.team2.score ? 'team1' : 'team2'
    });
    
    // Clean up the game state
    activeGames.delete(gameId);
    return;
  }
  
  // Increment round
  game.round++;
  
  // Switch roles
  game.team1.currentRole = game.team1.currentRole === 'illustrator' ? 'guesser' : 'illustrator';
  game.team2.currentRole = game.team2.currentRole === 'illustrator' ? 'guesser' : 'illustrator';
  
  // Get a new secret word
  game.secretWord = getRandomWord();
  
  // Reset round-specific state
  game.timeRemaining = 60;
  game.guesses = [];
  game.svgImage = null;
  
  // Emit new round event
  io.to(gameId).emit('new_round', {
    round: game.round,
    team1Role: game.team1.currentRole,
    team2Role: game.team2.currentRole,
    team1Score: game.team1.score,
    team2Score: game.team2.score
  });
  
  // Generate a new illustration for the new round
  generateIllustration(gameId, game);
}

// LLM API integration functions

/**
 * Generates an SVG using Anthropic's Claude
 * @param {string} secretWord The word to illustrate
 * @returns {Promise<string>} The SVG content
 */
async function generateSvgWithAnthropic(secretWord) {
  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 4000,
    system: `You are the Illustrator in a game of Pictionary. Your task is to create an SVG graphic that represents a secret word without using text or direct hints.
    
    The SVG should be clear enough for the Guesser to identify the word, but abstract enough to make it challenging.
    
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
    model: "claude-3-5-sonnet-20240620",
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
    model: "claude-3-5-sonnet-20240620",
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
async function generateSvgWithOpenAI(secretWord) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are the Illustrator in a game of Pictionary. Your task is to create an SVG graphic that represents a secret word without using text or direct hints.
    
    The SVG should be clear enough for the Guesser to identify the word, but abstract enough to make it challenging.
    
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
async function refineSvgWithOpenAI(secretWord, currentSvg, latestGuess, allGuesses) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
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
async function generateGuessWithOpenAI(svgContent, previousGuesses) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
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