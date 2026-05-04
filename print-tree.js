const fs = require('fs');
const path = require('path');

function printTree(dir, prefix = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const filtered = items.filter(item => !['node_modules', '.git', '.next'].includes(item.name));
  
  filtered.forEach((item, index) => {
    const isLast = index === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    console.log(prefix + connector + item.name);
    
    if (item.isDirectory()) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      printTree(path.join(dir, item.name), newPrefix);
    }
  });
}

printTree('.');
