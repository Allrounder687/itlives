const fs = require('fs');
const path = require('path');

const directory = 'd:\\use after format\\allrounder687\\.itlives\\apps\\itlives';

const replacements = [
    { regex: /itLives/g, replace: 'itLives' },
    { regex: /itLives/g, replace: 'itLives' },
    { regex: /ITLIVES/g, replace: 'ITLIVES' },
    { regex: /itlives/g, replace: 'itlives' },
    { regex: /itLives/g, replace: 'itLives' },
    { regex: /itlives/g, replace: 'itlives' },
];

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            if (!['node_modules', '.next', 'target', '.git', '.gemini', 'temp_test'].includes(f)) {
                walkDir(dirPath, callback);
            }
        } else {
            callback(dirPath);
        }
    });
}

let modifiedCount = 0;

walkDir(directory, (filePath) => {
    // Only process text files
    const ext = path.extname(filePath);
    if (!['.ts', '.tsx', '.js', '.json', '.rs', '.md', '.ps1', '.bat', '.toml', '.css'].includes(ext)) return;
    
    // Skip package-lock.json because npm install handles it
    if (filePath.endsWith('package-lock.json')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const { regex, replace } of replacements) {
        content = content.replace(regex, replace);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
        modifiedCount++;
    }
});

console.log(`Done. Modified ${modifiedCount} files.`);
