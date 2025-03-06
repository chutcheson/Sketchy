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

// Extended list of pictionary words
const extendedWordList = [
  // Common objects
  'chair', 'table', 'computer', 'book', 'pencil', 'telephone', 'umbrella', 'lamp', 'clock', 'camera',
  'bicycle', 'car', 'train', 'airplane', 'ship', 'hammer', 'screwdriver', 'key', 'ladder', 'scissors',
  'desk', 'couch', 'microwave', 'oven', 'toaster', 'dishwasher', 'remote', 'controller', 'television', 'radio',
  'backpack', 'wallet', 'purse', 'glasses', 'window', 'door', 'fence', 'broom', 'vacuum', 'pillow',
  
  // Animals
  'dog', 'cat', 'elephant', 'lion', 'tiger', 'giraffe', 'monkey', 'penguin', 'dolphin', 'turtle',
  'butterfly', 'spider', 'eagle', 'owl', 'snake', 'frog', 'fish', 'horse', 'rabbit', 'squirrel',
  'bear', 'wolf', 'zebra', 'kangaroo', 'koala', 'panda', 'gorilla', 'shark', 'whale', 'octopus',
  'bee', 'ant', 'mosquito', 'fly', 'mouse', 'rat', 'fox', 'deer', 'moose', 'camel',
  
  // Food and drinks
  'apple', 'banana', 'pizza', 'hamburger', 'ice cream', 'cake', 'coffee', 'sandwich', 'popcorn', 'spaghetti',
  'orange', 'grape', 'strawberry', 'watermelon', 'pineapple', 'carrot', 'broccoli', 'potato', 'tomato', 'onion',
  'cheese', 'milk', 'juice', 'water', 'soda', 'tea', 'cookie', 'candy', 'chocolate', 'pancake',
  'waffle', 'cereal', 'bread', 'toast', 'pretzel', 'donut', 'cupcake', 'pie', 'soup', 'salad',
  
  // Activities and actions
  'running', 'swimming', 'dancing', 'singing', 'jumping', 'sleeping', 'laughing', 'crying', 'reading', 'writing',
  'cooking', 'eating', 'drinking', 'talking', 'smiling', 'drawing', 'painting', 'climbing', 'falling', 'hiking',
  'skiing', 'skating', 'surfing', 'sailing', 'rowing', 'driving', 'flying', 'crawling', 'hiding', 'fighting',
  'building', 'breaking', 'catching', 'throwing', 'pulling', 'pushing', 'lifting', 'carrying', 'kicking', 'hugging',
  
  // Places and buildings
  'house', 'school', 'hospital', 'airport', 'beach', 'mountain', 'park', 'bridge', 'castle', 'library',
  'store', 'mall', 'restaurant', 'cafe', 'theater', 'cinema', 'museum', 'zoo', 'farm', 'factory',
  'office', 'hotel', 'apartment', 'church', 'temple', 'mosque', 'stadium', 'playground', 'garden', 'forest',
  'desert', 'island', 'cave', 'waterfall', 'lake', 'river', 'ocean', 'city', 'town', 'village',
  
  // Clothing
  'hat', 'shirt', 'pants', 'shoes', 'gloves', 'scarf', 'sunglasses', 'umbrella', 'watch', 'ring',
  'jacket', 'coat', 'sweater', 'dress', 'skirt', 'socks', 'boots', 'sandals', 'belt', 'tie',
  'necklace', 'earrings', 'bracelet', 'crown', 'helmet', 'swimsuit', 'uniform', 'pajamas', 'costume', 'mask',
  
  // Nature
  'tree', 'flower', 'sun', 'moon', 'star', 'rain', 'snow', 'river', 'ocean', 'forest',
  'mountain', 'hill', 'valley', 'canyon', 'volcano', 'earthquake', 'tornado', 'hurricane', 'lightning', 'thunder',
  'rainbow', 'cloud', 'fog', 'wind', 'fire', 'ice', 'grass', 'leaf', 'branch', 'root',
  'seed', 'rock', 'stone', 'sand', 'mud', 'soil', 'weed', 'moss', 'planet', 'comet',
  
  // Sports
  'soccer', 'football', 'baseball', 'basketball', 'tennis', 'golf', 'hockey', 'volleyball', 'bowling', 'boxing',
  'karate', 'judo', 'wrestling', 'swimming', 'diving', 'skiing', 'skating', 'cycling', 'running', 'jumping',
  'surfing', 'climbing', 'fishing', 'hunting', 'sailing', 'rowing', 'racing', 'dancing', 'gymnastics', 'yoga',
  
  // Vehicles
  'car', 'bus', 'truck', 'train', 'subway', 'tram', 'motorcycle', 'bicycle', 'scooter', 'skateboard',
  'boat', 'ship', 'cruise', 'yacht', 'canoe', 'kayak', 'raft', 'airplane', 'helicopter', 'jet',
  'rocket', 'spaceship', 'satellite', 'drone', 'ambulance', 'police car', 'fire truck', 'tractor', 'bulldozer', 'crane',
  
  // Professions
  'doctor', 'nurse', 'teacher', 'student', 'chef', 'waiter', 'firefighter', 'police', 'farmer', 'astronaut',
  'artist', 'musician', 'actor', 'dancer', 'writer', 'journalist', 'scientist', 'engineer', 'programmer', 'designer',
  'architect', 'builder', 'carpenter', 'plumber', 'electrician', 'mechanic', 'driver', 'pilot', 'sailor', 'soldier',
  'lawyer', 'judge', 'politician', 'king', 'queen', 'president', 'manager', 'cashier', 'salesman', 'guard',
  
  // Household items
  'sofa', 'couch', 'chair', 'table', 'desk', 'bed', 'pillow', 'blanket', 'lamp', 'light',
  'clock', 'alarm', 'phone', 'computer', 'laptop', 'tablet', 'television', 'remote', 'radio', 'speaker',
  'refrigerator', 'freezer', 'oven', 'stove', 'microwave', 'toaster', 'blender', 'kettle', 'pot', 'pan',
  'plate', 'bowl', 'cup', 'glass', 'fork', 'knife', 'spoon', 'napkin', 'broom', 'vacuum',
  
  // Instruments
  'guitar', 'piano', 'violin', 'cello', 'drums', 'saxophone', 'trumpet', 'flute', 'clarinet', 'harp',
  'accordion', 'banjo', 'ukulele', 'harmonica', 'xylophone', 'tambourine', 'bell', 'whistle', 'microphone', 'speaker',
  
  // Tools
  'hammer', 'screwdriver', 'wrench', 'pliers', 'saw', 'drill', 'nail', 'screw', 'bolt', 'nut',
  'ladder', 'scissors', 'knife', 'axe', 'shovel', 'rake', 'hoe', 'wheelbarrow', 'cart', 'measuring tape',
  
  // Electronics
  'computer', 'laptop', 'tablet', 'phone', 'smartphone', 'camera', 'headphone', 'speaker', 'microphone', 'keyboard',
  'mouse', 'monitor', 'printer', 'scanner', 'router', 'modem', 'battery', 'charger', 'cable', 'controller',
  
  // Concepts (more challenging)
  'love', 'peace', 'friendship', 'freedom', 'justice', 'happiness', 'sadness', 'anger', 'fear', 'courage',
  'danger', 'victory', 'defeat', 'success', 'failure', 'life', 'death', 'health', 'illness', 'strength',
  'weakness', 'growth', 'decay', 'beginning', 'end', 'knowledge', 'ignorance', 'truth', 'lie', 'dream',
  'nightmare', 'reality', 'fantasy', 'time', 'space', 'distance', 'direction', 'speed', 'weight', 'temperature'
];

// Combine the original and extended lists
alphaWords = [...words, ...extendedWordList];

// Remove duplicates
alphaWords = [...new Set(alphaWords)];

console.log(`Using ${alphaWords.length} words from extended word list.`);

// Track words that have been used in this session
const usedWords = new Set();

/**
 * Returns a random word that hasn't been used this session
 * @returns {string} A random word
 */
function getRandomWord() {
  // If we've used all words, reset the used words set
  if (usedWords.size >= alphaWords.length * 0.9) {
    console.log('Resetting used words list - most words have been used');
    usedWords.clear();
  }
  
  // Try to find a word that hasn't been used yet
  let attempts = 0;
  let word;
  
  do {
    const randomIndex = Math.floor(Math.random() * alphaWords.length);
    word = alphaWords[randomIndex];
    attempts++;
    
    // Prevent infinite loop if somehow all words are used
    if (attempts > 100) {
      console.log('Too many attempts to find unused word, resetting used words');
      usedWords.clear();
      break;
    }
  } while (usedWords.has(word));
  
  // Mark this word as used
  usedWords.add(word);
  console.log(`Selected word: "${word}" (${usedWords.size}/${alphaWords.length} words used)`);
  
  return word;
}

module.exports = { getRandomWord };