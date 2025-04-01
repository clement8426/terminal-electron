const { Terminal } = require('xterm');
const { exec } = require('child_process');
const { readdirSync } = require('fs');
const path = require('path');
const fs = require('fs');

// Initialisation du terminal
const term = new Terminal({
  cols: 80,
  rows: 24,
  convertEol: true,
  cursorBlink: true,
  theme: { background: '#252526', foreground: '#d4d4d4' }
});
const terminalContainer = document.getElementById('terminal-container');
term.open(terminalContainer);

let currentDir = process.cwd();
let buffer = '';
let commandHistory = [];
let historyIndex = -1;
let cursorPos = 0;
let tabCompletions = [];
let tabIndex = -1;

// Thèmes avec palette ANSI complète (inchangé)
const themes = {
  dark: { xterm: { background: '#252526', foreground: '#d4d4d4', cursor: '#ff9900', black: '#000000', red: '#ff5555', green: '#55ff55', yellow: '#ffff55', blue: '#5555ff', magenta: '#ff55ff', cyan: '#55ffff', white: '#bbbbbb', brightBlack: '#555555', brightRed: '#ff9999', brightGreen: '#99ff99', brightYellow: '#ffff99', brightBlue: '#9999ff', brightMagenta: '#ff99ff', brightCyan: '#99ffff', brightWhite: '#ffffff' }, css: `body { background: #1e1e1e; color: #d4d4d4; } #terminal-container { background: #252526; } button { background: #3c3c3c; color: #d4d4d4; } button:hover { background: #555; }` },
  dracula: { xterm: { background: '#282a36', foreground: '#f8f8f2', cursor: '#bd93f9', black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2', brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff' }, css: `body { background: #282a36; color: #f8f8f2; } #terminal-container { background: #282a36; } button { background: #44475a; color: #f8f8f2; } button:hover { background: #6272a4; }` }
};

// Fonction pour changer de thème
function switchTheme(themeName) {
  const theme = themes[themeName];
  term.options.theme = theme.xterm;
  document.getElementById('theme-style').innerHTML = theme.css;
  term.refresh(0, term.rows - 1);
  updatePrompt();
}

// Gestion du prompt
function updatePrompt() {
  term.write(`\r\n\x1b[36m${currentDir}\x1b[0m > `);
}

// Autocomplétion pour cd
function autocompleteCd() {
  if (buffer.startsWith('cd ')) {
    const input = buffer.slice(3).trim();
    if (tabCompletions.length === 0 || !buffer.startsWith('cd ' + tabCompletions[tabIndex])) {
      tabCompletions = readdirSync(currentDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => name.startsWith(input));
      tabIndex = -1;
    }
    if (tabCompletions.length > 0) {
      tabIndex = (tabIndex + 1) % tabCompletions.length;
      buffer = 'cd ' + tabCompletions[tabIndex];
      cursorPos = buffer.length;
      term.write('\r\x1b[K' + currentDir + ' > ' + buffer);
    }
  }
}

// Gestion des entrées avec log des touches
term.onData(data => {
  if (data === '\r') { // Entrée
    executeCommand(buffer.trim());
    buffer = '';
    cursorPos = 0;
  } else if (data === '\x7f') { // Backspace
    if (cursorPos > 0) {
      buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos);
      cursorPos--;
      term.write('\b \b');
    }
  } else if (data === '\x1b[3~') { // Delete
    if (cursorPos < buffer.length) {
      buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1);
      term.write('\x1b[K' + buffer.slice(cursorPos));
      term.write('\x1b[' + (buffer.length - cursorPos) + 'D');
    }
  } else if (data === '\x03') { // Ctrl+C
    term.write('^C');
    buffer = '';
    cursorPos = 0;
    updatePrompt();
  } else if (data === '\t') { // Tab
    autocompleteCd();
  } else if (data === '\x1b[A') { // Flèche haut
    if (historyIndex > 0) {
      historyIndex--;
      buffer = commandHistory[historyIndex] || '';
      cursorPos = buffer.length;
      term.write('\r\x1b[K' + currentDir + ' > ' + buffer);
    }
  } else if (data === '\x1b[B') { // Flèche bas
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      buffer = commandHistory[historyIndex];
      cursorPos = buffer.length;
      term.write('\r\x1b[K' + currentDir + ' > ' + buffer);
    } else {
      historyIndex = commandHistory.length;
      buffer = '';
      cursorPos = 0;
      term.write('\r\x1b[K' + currentDir + ' > ');
    }
  } else {
    buffer = buffer.slice(0, cursorPos) + data + buffer.slice(cursorPos);
    cursorPos++;
    term.write(data);
  }
});

function executeCommand(command) {
  if (command) {
    commandHistory.push(command);
    historyIndex = commandHistory.length;
  }

  if (command.startsWith('cd ')) {
    const newDir = command.slice(3).trim();
    try {
      currentDir = path.resolve(currentDir, newDir);
      process.chdir(currentDir);
    } catch {
      term.write('\r\n\x1b[31mRépertoire introuvable\x1b[0m');
    }
    updatePrompt();
  } else if (command.startsWith('touch ')) {
    const fileName = command.split(' ')[1];
    if (fileName) {
      fs.closeSync(fs.openSync(path.join(currentDir, fileName), 'w'));
      term.write('\r\nFichier créé : ' + fileName);
    } else {
      term.write('\r\n\x1b[31mNom de fichier requis\x1b[0m');
    }
    updatePrompt();
  } else if (command.startsWith('mkdir ')) {
    const dirName = command.split(' ')[1];
    if (dirName) {
      fs.mkdirSync(path.join(currentDir, dirName));
      term.write('\r\nRépertoire créé : ' + dirName);
    } else {
      term.write('\r\n\x1b[31mNom de répertoire requis\x1b[0m');
    }
    updatePrompt();
  } else if (command === 'll') {
    exec('ls -l', { cwd: currentDir }, (error, stdout, stderr) => {
      if (error) {
        term.write(`\r\n\x1b[31mErreur : ${error.message}\x1b[0m`);
      } else {
        term.write(`\r\n${stdout}`);
      }
      updatePrompt();
    });
  } else if (command === 'pwd') {
    term.write(`\r\n${currentDir}`);
    updatePrompt();
  } else {
    exec(command, { cwd: currentDir }, (error, stdout, stderr) => {
      if (error) {
        term.write(`\r\n\x1b[31mErreur : ${error.message}\x1b[0m`);
      } else {
        term.write(`\r\n${stdout}`);
      }
      updatePrompt();
    });
  }
}

// Fonction pour installer un outil
function installTool(tool) {
  let installCmd = '';
  switch (tool) {
    case 'nmap':
      installCmd = process.platform === 'win32' ?
        'echo Téléchargez Nmap depuis nmap.org' :
        (process.platform === 'darwin' ? 'brew install nmap' : 'sudo apt install nmap -y');
      break;
    case 'git':
      installCmd = process.platform === 'win32' ?
        'echo Téléchargez Git depuis git-scm.com' :
        (process.platform === 'darwin' ? 'brew install git' : 'sudo apt install git -y');
      break;
    // Ajoutez d'autres outils ici
    default:
      term.write('\r\n\x1b[31mOutil non reconnu\x1b[0m');
      return;
  }
  term.write('\r\nInstallation de ' + tool + ' avec : ' + installCmd);
  exec(installCmd, { cwd: currentDir }, (error, stdout, stderr) => {
    if (error) {
      term.write('\r\n\x1b[31mErreur : ' + error.message + '\x1b[0m');
    } else {
      term.write('\r\n' + tool + ' installé !');
    }
    updatePrompt();
  });
}

// Ajouter les événements des boutons
document.getElementById('dark-btn').addEventListener('click', () => switchTheme('dark'));
document.getElementById('dracula-btn').addEventListener('click', () => switchTheme('dracula'));

// Gestion du bouton "Outils"
document.getElementById('tools-btn').addEventListener('click', () => {
  const toolsMenu = document.getElementById('tools-menu');
  toolsMenu.style.display = toolsMenu.style.display === 'none' ? 'block' : 'none';
});

// Gestion des boutons d'outils
document.querySelectorAll('.tool-btn').forEach(button => {
  button.addEventListener('click', () => {
    const tool = button.getAttribute('data-tool');
    installTool(tool);
  });
});

// Initialisation
term.write('Bienvenue dans le terminal !\r\n');
updatePrompt();
