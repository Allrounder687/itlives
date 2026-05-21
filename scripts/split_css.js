const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'app');
const globalsPath = path.join(srcDir, 'globals.css');
const stylesDir = path.join(srcDir, 'styles');

if (!fs.existsSync(stylesDir)) fs.mkdirSync(stylesDir, { recursive: true });

const css = fs.readFileSync(globalsPath, 'utf8');

// Categories we want to split out based on prefixes or class names
const chunks = {
  base: [],
  layout: [],
  components: [],
  forms: [],
  utilities: [],
  media: []
};

// We will split the file by CSS blocks (very rudimentary but works for standard formatted CSS)
// A block is separated by empty lines or standard `}`
let currentBlock = [];
let dest = 'components';

const lines = css.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.startsWith('@import')) {
    chunks.base.push(line);
    continue;
  }

  currentBlock.push(line);
  
  // Very simplistic check if block is closed (handles media queries if they have nested `}`, 
  // wait actually, for media queries, they have nested braces. It's safer to just do a brace count!
}

// Brace counting parser
const parsedChunks = {
    base: [],
    layout: [],
    components: [],
    previews: [],
    cards: [],
    navigation: [],
    media: [] // <1200, <820 etc.
};

let braceLevel = 0;
let blockLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // handle imports immediately
  if (line.trim().startsWith('@import') && braceLevel === 0) {
    parsedChunks.base.push(line);
    continue;
  }

  blockLines.push(line);

  // Quick brace count
  const openCount = (line.match(/\{/g) || []).length;
  const closeCount = (line.match(/\}/g) || []).length;
  
  braceLevel += openCount;
  braceLevel -= closeCount;

  if (braceLevel === 0 && blockLines.join('').trim().length > 0) {
      // Block finished
      let blockStr = blockLines.join('\n');
      
      // Categorization
      if (blockStr.includes('@media')) {
          parsedChunks.media.push(blockStr);
      } else if (blockStr.includes(':root') || blockStr.startsWith('body ') || blockStr.startsWith('html') || blockStr.startsWith('* {') || blockStr.includes('::-webkit')) {
          parsedChunks.base.push(blockStr);
      } else if (blockStr.includes('.shell') || blockStr.includes('.workspace')) {
          parsedChunks.layout.push(blockStr);
      } else if (blockStr.includes('.sidebar') || blockStr.includes('.titlebar') || blockStr.includes('.tab-')) {
          parsedChunks.navigation.push(blockStr);
      } else if (blockStr.includes('.panel') || blockStr.includes('.card') || blockStr.includes('.hero')) {
          parsedChunks.cards.push(blockStr);
      } else if (blockStr.includes('.preview-')) {
          parsedChunks.previews.push(blockStr);
      } else {
          parsedChunks.components.push(blockStr);
      }

      blockLines = [];
  }
}

// Write the files out
for (const [key, val] of Object.entries(parsedChunks)) {
    if (val.length === 0) continue;
    fs.writeFileSync(path.join(stylesDir, `${key}.css`), val.join('\n\n') + '\n');
}

// Generate the new globals.css
const newGlobals = [];
newGlobals.push('/* Core imports */');
Object.keys(parsedChunks).forEach(key => {
    if (parsedChunks[key].length > 0 && key !== 'base') {
        newGlobals.push(`@import url("./styles/${key}.css");`);
    }
});

// Write new globals
fs.writeFileSync(globalsPath, parsedChunks.base.join('\n\n') + '\n\n' + newGlobals.join('\n') + '\n');
console.log('Split CSS Successfully!');
