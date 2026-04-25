const fs = require('fs');
const path = require('path');

const iconMapping = {
  'ArrowCounterclockwiseIcon': 'RotateCcw',
  'ArrowDownIcon': 'ArrowDown',
  'ArrowElbowRightUp': 'ArrowUpRight',
  'ArrowLeftIcon': 'ArrowLeft',
  'ArrowRightIcon': 'ArrowRight',
  'ArrowSquareOutIcon': 'ExternalLink',
  'ArrowUpIcon': 'ArrowUp',
  'CalendarIcon': 'Calendar',
  'CheckIcon': 'Check',
  'ChevronDownIcon': 'ChevronDown',
  'ChevronLeftIcon': 'ChevronLeft',
  'ChevronRightIcon': 'ChevronRight',
  'ChevronUpIcon': 'ChevronUp',
  'ClockIcon': 'Clock',
  'CloudIcon': 'Cloud',
  'CogIcon': 'Settings',
  'ColumnIcon': 'Columns',
  'CopyIcon': 'Copy',
  'DatabaseIcon': 'Database',
  'DotsHorizontalIcon': 'MoreHorizontal',
  'DotsVerticalIcon': 'MoreVertical',
  'ExclamationFilledIcon': 'AlertCircle',
  'ExclamationIcon': 'AlertTriangle',
  'EyeIcon': 'Eye',
  'EyeOffIcon': 'EyeOff',
  'FileTextIcon': 'FileText',
  'GaugeIcon': 'Gauge',
  'HomeIcon': 'Home',
  'InfoIcon': 'Info',
  'InfoOutlinedIcon': 'Info',
  'LinkIcon': 'Link',
  'LockIcon': 'Lock',
  'MenuIcon': 'Menu',
  'MinusIcon': 'Minus',
  'PencilIcon': 'Edit',
  'PlayIcon': 'Play',
  'PlusCircleIcon': 'PlusCircle',
  'PlusIcon': 'Plus',
  'PowerOffIcon': 'Power',
  'QuestionMarkCircleIcon': 'HelpCircle',
  'QuestionMarkIcon': 'Help',
  'RepeatIcon': 'RotateCw',
  'RocketIcon': 'Rocket',
  'RowIcon': 'Rows',
  'SearchIcon': 'Search',
  'SlidersIcon': 'Sliders',
  'StorageIcon': 'HardDrive',
  'TerminalIcon': 'Terminal',
  'TrashIcon': 'Trash2',
  'UploadIcon': 'Upload',
  'UserIcon': 'User',
  'UsersIcon': 'Users',
  'WarningIcon': 'AlertTriangle',
  'XIcon': 'X'
};

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

function cleanupAndConsolidateImports(content) {
  let modified = false;
  
  // Collect all lucide imports
  const lucideImports = new Set();
  const customIconsToRemove = [];
  
  const lines = content.split('\n');
  const resultLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a lucide import line
    if (line.includes(`from 'lucide-react'`)) {
      const importMatch = line.match(/import\s*{([^}]+)}\s*from\s*['"]lucide-react['"]/);
      if (importMatch) {
        const imports = importMatch[1];
        const importedItems = imports.split(',').map(s => s.trim()).filter(s => s);
        importedItems.forEach(item => lucideImports.add(item));
        customIconsToRemove.push(i);
        modified = true;
      }
    }
  }
  
  // Rebuild with consolidated import
  if (modified && lucideImports.size > 0) {
    const lucideArray = Array.from(lucideImports).sort();
    const consolidatedImport = `import { ${lucideArray.join(', ')} } from 'lucide-react';`;
    
    // Find where to insert the consolidated import (after other imports)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        insertIndex = i + 1;
      }
    }
    
    // Remove all old lucide import lines (in reverse to maintain indices)
    for (let i = customIconsToRemove.length - 1; i >= 0; i--) {
      lines.splice(customIconsToRemove[i], 1);
    }
    
    // Add consolidated import if not already there
    const hasConsolidated = lines.some(l => l.includes(`from 'lucide-react'`));
    if (!hasConsolidated && lucideImports.size > 0) {
      lines.splice(insertIndex, 0, consolidatedImport);
    }
    
    content = lines.join('\n');
  }
  
  return { content, modified };
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix import names (e.g., CloudIcon -> Cloud)
    for (const [oldName, newName] of Object.entries(iconMapping)) {
      const regex = new RegExp(`import\\s*{\\s*([^}]*)${oldName}([^}]*)\\s*}\\s*from\\s*['"]lucide-react['"]`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, (match, before, after) => {
          const imports = `${before}${newName}${after}`.split(',').map(s => s.trim()).filter(s => s).join(', ');
          return `import { ${imports} } from 'lucide-react'`;
        });
        modified = true;
      }
    }
    
    // Consolidate imports
    const { content: cleanedContent, modified: wasModified } = cleanupAndConsolidateImports(content);
    if (wasModified) {
      modified = true;
    }
    content = cleanedContent;
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      return true;
    }
  } catch (e) {
    // silently skip errors
  }
  return false;
}

console.log('Cleaning up and consolidating icon imports...\n');

const dashboardSrc = path.join(process.cwd(), 'dashboard', 'src');
const allFiles = getAllFiles(dashboardSrc);
console.log(`Processing ${allFiles.length} files\n`);

let totalModified = 0;

for (const file of allFiles) {
  if (processFile(file)) {
    totalModified++;
    console.log(`✓ ${file}`);
  }
}

console.log(`\nTotal files cleaned up: ${totalModified}`);
