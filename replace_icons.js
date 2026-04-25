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

function replaceInFile(filePath, customIcon, lucideIcon) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace import statement
    const importRegex = new RegExp(`from ['"]@/components/ui/v2/icons/${customIcon}['"]`, 'g');
    if (importRegex.test(content)) {
      content = content.replace(importRegex, `from 'lucide-react'`);
      modified = true;
      
      // Handle lucide icon addition to imports
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`from 'lucide-react'`)) {
          if (!lines[i].includes(lucideIcon)) {
            // Add lucideIcon to this import
            lines[i] = lines[i].replace(/\{([^}]+)\}/, `{$1, ${lucideIcon}}`);
          }
          break;
        }
      }
      content = lines.join('\n');
    }
    
    // Replace component usage
    const componentRegex = new RegExp(`<${customIcon}([ />])`, 'g');
    if (componentRegex.test(content)) {
      content = content.replace(componentRegex, `<${lucideIcon}$1`);
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✓ ${filePath}`);
      return true;
    }
  } catch (e) {
    // silently skip errors
  }
  return false;
}

console.log('Starting icon replacement...\n');

const dashboardSrc = path.join(process.cwd(), 'dashboard', 'src');
const allFiles = getAllFiles(dashboardSrc);
console.log(`Found ${allFiles.length} files to process\n`);

let totalModified = 0;

for (const [customIcon, lucideIcon] of Object.entries(iconMapping)) {
  for (const file of allFiles) {
    if (replaceInFile(file, customIcon, lucideIcon)) {
      totalModified++;
    }
  }
}

console.log(`\nTotal files modified: ${totalModified}`);
