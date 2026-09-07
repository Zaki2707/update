import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

// The block starts with app.post("/api/sync-state", async (req, res) => {
// Let's print the entire block to see what's wrong.
const start = content.indexOf('app.post("/api/sync-state", async (req, res) => {');
const end = content.indexOf('// Real-time Event Stream', start);
console.log(content.substring(start, end));

