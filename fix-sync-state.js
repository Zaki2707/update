import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// The `saveDataBatch` or `saveData` might be used inside `sync-state`.
// Let's check sync-state.
const match = content.match(/app\.post\("\/api\/sync-state"[\s\S]*?(?=\napp\.)/);
if (match) {
    console.log(match[0]);
} else {
    console.log("Not found");
}
