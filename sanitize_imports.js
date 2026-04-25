const fs = require('fs');
const path = require('path');

function getAllFiles(dir) {
  const files = [];
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!item.startsWith('node_modules') && !item.startsWith('.')) {
          files.push(...getAllFiles(fullPath));
        }
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  } catch (e) {}
  
  return files;
}

function sanitizeImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Fix broken imports where lucide got merged
    content = content.replace(/,\s*import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g, 
      '\n\nimport { $1 } from \'lucide-react\'');
    
    const lines = content.split('\n');
    const lucideImports = [];
    const cleanedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('from \'lucide-react\'') || line.includes('from "lucide-react"')) {
        lucideImports.push(line);
      } else {
        cleanedLines.push(line);
      }
    }
    
    // Reconstruct
    const importEndIndex = cleanedLines.findIndex((line, idx) => 
      idx > 0 && !line.match(/^import/) && !line.match(/^\s*$/) && !line.match(/^\/\//)
    );
    
    if (lucideImports.length > 0) {
      if (importEndIndex >= 0) {
        cleanedLines.splice(importEndIndex, 0, ...lucideImports);
      } else {
        cleanedLines.push(...lucideImports);
      }
    }
    
    content = cleanedLines.join('\n');
    content = content.replace(/\n\n\n+/g, '\n\n');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content);
      return true;
    }
  } catch (e) {
    console.error(`Error in ${path.basename(filePath)}: ${e.message}`);
  }
  return false;
}

console.log('Sanitizing imports...\n');

const dashboardSrc = path.join(process.cwd(), 'dashboard', 'src');
const allFiles = getAllFiles(dashboardSrc);

let totalFixed = 0;
for (const file of allFiles) {
  if (sanitizeImportsInFile(file)) {
    totalFixed++;
    console.log(`✓ ${path.basename(file)}`);
  }
}

console.log(`\nTotal files sanitized: ${totalFixed}`);
