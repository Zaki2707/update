import fs from 'fs';

const serverTs = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.(post|put)\("([^"]+)"[\s\S]*?(?=\napp\.)/g;
let match;
while ((match = regex.exec(serverTs)) !== null) {
    const method = match[1];
    const endpoint = match[2];
    const body = match[0];
    
    if (body.includes('photo') || body.includes('image') || body.includes('imageUrl') || body.includes('livecamFrame')) {
        console.log(`Endpoint: ${method.toUpperCase()} ${endpoint}`);
    }
}
