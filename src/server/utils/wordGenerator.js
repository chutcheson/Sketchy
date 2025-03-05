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

/**
 * Returns a random word from the predefined list
 * @returns {string} A random word
 */
function getRandomWord() {
  const randomIndex = Math.floor(Math.random() * words.length);
  return words[randomIndex];
}

module.exports = { getRandomWord };