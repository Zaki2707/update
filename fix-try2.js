import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

// There are two "try {" and two "const { key, data } = req.body;"
const badString = `  try {
    const { key, data } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key required" });
`;
// Let's just find the index of the second try {
let firstTry = content.indexOf('app.post("/api/sync-state", async (req, res) => {');
let secondTry = content.indexOf('  try {', firstTry + 100);
if (secondTry !== -1) {
    let secondTryEnd = content.indexOf('if (!key)', secondTry);
    let nextLine = content.indexOf('\n', secondTryEnd + 50);
    let removeStr = content.substring(secondTry, nextLine);
    content = content.replace(removeStr, '');
    fs.writeFileSync('server.ts', content);
    console.log("Fixed try!");
} else {
    console.log("Not found");
}

