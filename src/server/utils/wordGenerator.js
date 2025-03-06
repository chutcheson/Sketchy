/**
 * A list of words suitable for Pictionary
 */
const words = [
  // Common objects
  'chair', 'table', 'computer', 'book', 'pencil', 'telephone', 'umbrella', 'lamp', 'clock', 'camera',
  'bicycle', 'car', 'train', 'airplane', 'ship', 'hammer', 'screwdriver', 'key', 'ladder', 'scissors',
  
  // Animals
  'dog', 'cat', 'elephant', 'lion', 'tiger', 'giraffe', 'monkey', 'penguin', 'dolphin', 'turtle',
  'butterfly', 'spider', 'eagle', 'owl', 'snake', 'frog', 'fish', 'horse', 'rabbit', 'squirrel',
  
  // Food and drinks
  'apple', 'banana', 'pizza', 'hamburger', 'ice cream', 'cake', 'coffee', 'sandwich', 'popcorn', 'spaghetti',
  
  // Activities and actions
  'running', 'swimming', 'dancing', 'singing', 'jumping', 'sleeping', 'laughing', 'crying', 'reading', 'writing',
  
  // Places and buildings
  'house', 'school', 'hospital', 'airport', 'beach', 'mountain', 'park', 'bridge', 'castle', 'library',
  
  // Clothing
  'hat', 'shirt', 'pants', 'shoes', 'gloves', 'scarf', 'sunglasses', 'umbrella', 'watch', 'ring',
  
  // Nature
  'tree', 'flower', 'sun', 'moon', 'star', 'rain', 'snow', 'river', 'ocean', 'forest',
  
  // Professions
  'doctor', 'teacher', 'chef', 'firefighter', 'police officer', 'farmer', 'astronaut', 'artist', 'musician', 'scientist',
  
  // Household items
  'sofa', 'television', 'refrigerator', 'microwave', 'washing machine', 'bed', 'mirror', 'toothbrush', 'bathtub', 'doorbell',
  
  // Concepts (a bit more challenging)
  'love', 'peace', 'friendship', 'freedom', 'justice', 'happiness', 'danger', 'competition', 'knowledge', 'dream'
];

// Load words from the alpha words dictionary
const fs = require('fs');
const path = require('path');
let alphaWords = [];

try {
  const alphaWordPath = path.join(__dirname, '../../../words_alpha.txt');
  if (fs.existsSync(alphaWordPath)) {
    // Load the word list
    const wordData = fs.readFileSync(alphaWordPath, 'utf8');
    alphaWords = wordData.split('\n').filter(word => 
      // Filter for words between 4-8 characters for better game experience
      word.length >= 4 && word.length <= 8 && /^[a-z]+$/.test(word)
    );
    console.log(`Loaded ${alphaWords.length} words from dictionary.`);
  }
} catch (error) {
  console.error('Error loading alpha words dictionary:', error);
}

/**
 * Returns a random word from the dictionary if available, 
 * otherwise from the predefined list
 * @returns {string} A random word
 */
function getRandomWord() {
  // Use alpha words dictionary if available
  if (alphaWords.length > 0) {
    const randomIndex = Math.floor(Math.random() * alphaWords.length);
    return alphaWords[randomIndex];
  }
  
  // Fallback to predefined list
  const randomIndex = Math.floor(Math.random() * words.length);
  return words[randomIndex];
}

module.exports = { getRandomWord };