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
  } catch (e) {
    // silently skip errors
  }
  
  return files;
}

function fixImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Extract all lucide imports
    const lucideImportMatches = [...content.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)];
    
    if (lucideImportMatches.length === 0) {
      return false; // No lucide imports
    }
    
    // Collect all imported icons
    const lucideIcons = new Set();
    lucideImportMatches.forEach(match => {
      const imports = match[1].split(',').map(s => s.trim()).filter(s => s);
      imports.forEach(icon => {
        lucideIcons.add(icon);
      });
    });
    
    // Remove all lucide imports from their current locations
    content = content.replace(/import\s*\{[^}]*\}\s*from\s*['"]lucide-react['"]\s*;?\s*\n?/g, '');
    
    // Remove any duplicate newlines created
    content = content.replace(/\n\n\n+/g, '\n\n');
    
    // Find the position after the last non-lucide import
    const lines = content.split('\n');
    let lastImportLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s+/)) {
        lastImportLine = i;
      } else if (lastImportLine >= 0 && !lines[i].match(/^import\s+/)) {
        // Found first non-import line after imports
        break;
      }
    }
    
    if (lastImportLine >= 0 && lucideIcons.size > 0) {
      // Add consolidated lucide import after last regular import
      const sortedIcons = Array.from(lucideIcons).sort().join(', ');
      const lucideImport = `import { ${sortedIcons} } from 'lucide-react';`;
      lines.splice(lastImportLine + 1, 0, lucideImport);
      content = lines.join('\n');
    }
    
    if (content !== original) {
      fs.writeFileSync(filePath, content);
      return true;
    }
  } catch (e) {
    // silently skip errors
  }
  return false;
}

console.log('Fixing import statements...\n');

const dashboardSrc = path.join(process.cwd(), 'dashboard', 'src');
const allFiles = getAllFiles(dashboardSrc);

let totalFixed = 0;

for (const file of allFiles) {
  if (fixImportsInFile(file)) {
    totalFixed++;
    console.log(`✓ ${file}`);
  }
}

console.log(`\nTotal files fixed: ${totalFixed}`);
