const fs = require('fs');
const path = require('path');

let output = '';

function printTree(dir, prefix = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  // Ignorar node_modules, .git, .next, y nuestros propios scripts de utilidad
  const filtered = items.filter(item => !['node_modules', '.git', '.next', 'print-tree.js', 'print-tree-utf8.js', 'structure.txt', 'structure_utf8.txt'].includes(item.name));
  
  filtered.forEach((item, index) => {
    const isLast = index === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    output += prefix + connector + item.name + '\n';
    
    if (item.isDirectory()) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      printTree(path.join(dir, item.name), newPrefix);
    }
  });
}

printTree('.');
fs.writeFileSync('structure_utf8.txt', output, 'utf8');
