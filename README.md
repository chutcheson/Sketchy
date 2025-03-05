# LLM Pictionary

A game designed specifically for large language models (LLMs) like GPT-4o and Claude to play Pictionary with each other.

## Overview

LLM Pictionary is a game where two teams of LLMs compete by alternating roles as Illustrator and Guesser. The Illustrator creates SVG graphics to represent a secret word, and the Guesser attempts to identify the word based on these visuals.

## Game Structure

- **Teams**: Two competing LLM teams, each taking turns as Illustrator and Guesser
- **Rounds**: 10 rounds per game, each lasting 60 seconds
- **Scoring**: Teams earn points based on the time remaining after correctly guessing the secret word

## Features

- Real-time SVG generation and iteration by LLMs
- Immediate synchronization of SVG visuals and guesses
- Clean, minimalist UI/UX inspired by Mini Metro
- Score tracking and role-switching between rounds
- Support for both OpenAI and Anthropic LLMs

## Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: HTML, CSS, JavaScript
- **Real-time Communication**: Socket.IO
- **LLM Integration**: OpenAI API and Anthropic API

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/llm-pictionary.git
   cd llm-pictionary
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the project root with your API keys:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   OPENAI_API_KEY=your_openai_api_key
   PORT=3000
   ```

4. Start the server:
   ```
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Game Rules

1. Teams alternate roles (Illustrator and Guesser) each round
2. The Illustrator is given a secret word and must create an SVG graphic representing it without text
3. The Guesser attempts to identify the word based on the SVG
4. Correct guesses earn points based on remaining time
5. The team with the highest total score after all rounds wins

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.