import fs from 'fs';
import path from 'path';

// Directories to ignore
const IGNORE_DIRS = ['.git', 'node_modules', 'dist'];

function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    
    // Process files
    if (entry.isFile()) {
      let contentChanged = false;
      const originalContent = fs.readFileSync(fullPath, 'utf8');
      let newContent = originalContent;

      // Ensure we don't mess up binary files... simple check
      if (originalContent.includes('\0')) continue;

      // Replace common strings
      newContent = newContent
        .replace(/oh-my-gemini/g, 'oh-my-gemini')
        .replace(/oh-my-gemini/g, 'oh-my-gemini')
        .replace(/gemini-cli/g, 'gemini-cli')
        .replace(/gemini-cli/g, 'gemini-cli')
        .replace(/gemini CLI/g, 'gemini CLI')
        .replace(/gemini/gi, match => {
          if (match === 'gemini') return 'gemini';
          if (match === 'Gemini') return 'Gemini';
          if (match === 'GEMINI') return 'GEMINI';
          return match;
        })
        .replace(/gemini/gi, match => {
          if (match === 'gemini') return 'gemini';
          if (match === 'Gemini') return 'Gemini';
          if (match === 'GEMINI') return 'GEMINI';
          return match;
        })
        .replace(/omg/g, 'omg')
        .replace(/OMG/g, 'OMG');
        
      if (newContent !== originalContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
      }

      // Rename file if necessary
      if (entry.name.toLowerCase().includes('gemini')) {
        const newName = entry.name.replace(/gemini/gi, match => {
          if (match === 'gemini') return 'gemini';
          if (match === 'Gemini') return 'Gemini';
          if (match === 'GEMINI') return 'GEMINI';
          return match;
        });
        fs.renameSync(fullPath, path.join(dirPath, newName));
      }
      
      if (entry.name.toLowerCase().includes('omg')) {
        const newName = entry.name.replace(/omg/g, 'omg').replace(/OMG/g, 'OMG');
        if (newName !== entry.name) {
             const finalPath = path.join(dirPath, newName);
             if (!fs.existsSync(finalPath)) {
                fs.renameSync(path.join(dirPath, entry.name.replace(/gemini/gi, 'gemini')), finalPath);
             }
        }
      }
    } 
    // Process directories recursively
    else if (entry.isDirectory()) {
      processDirectory(fullPath);
      
      // Rename directory if necessary
      if (entry.name.toLowerCase().includes('gemini')) {
        const newName = entry.name.replace(/gemini/gi, match => {
          if (match === 'gemini') return 'gemini';
          if (match === 'Gemini') return 'Gemini';
          if (match === 'GEMINI') return 'GEMINI';
          return match;
        });
        fs.renameSync(fullPath, path.join(dirPath, newName));
      }
    }
  }
}

console.log('Starting refactor...');
processDirectory(process.cwd());
console.log('Refactor complete.');
