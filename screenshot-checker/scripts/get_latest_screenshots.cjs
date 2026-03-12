const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCREENSHOT_DIR = '/home/mark/Pictures/Screenshots';
const TMP_DIR = '/home/mark/.gemini/tmp/daatan/screenshots';

function getLatestScreenshots(n) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    console.error(`Error: Screenshot directory ${SCREENSHOT_DIR} does not exist.`);
    process.exit(1);
  }

  // Ensure tmp dir exists
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  // List files sorted by time
  const files = fs.readdirSync(SCREENSHOT_DIR)
    .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'))
    .map(f => ({ name: f, time: fs.statSync(path.join(SCREENSHOT_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time)
    .slice(0, n);

  const copiedFiles = [];
  files.forEach((file, index) => {
    const src = path.join(SCREENSHOT_DIR, file.name);
    const destName = `screenshot_${index + 1}${path.extname(file.name)}`;
    const dest = path.join(TMP_DIR, destName);
    fs.copyFileSync(src, dest);
    copiedFiles.push({ original: file.name, local: dest });
  });

  return copiedFiles;
}

const n = parseInt(process.argv[2]) || 1;
const screenshots = getLatestScreenshots(n);

if (screenshots.length === 0) {
  console.log('No screenshots found.');
} else {
  console.log(`Successfully copied ${screenshots.length} latest screenshots to workspace:`);
  screenshots.forEach(s => {
    console.log(`- ${s.local} (Original: ${s.original})`);
  });
}
