import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  `            if (data[i] && data[i].imageUrl && data[i].imageUrl.startsWith("data:image/")) {
                data[i].imageUrl = await saveBase64ToFirestore(data[i].imageUrl);
            }
        }
    }
  try {
    const { key, data } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key required" });`,
  `            if (data[i] && data[i].imageUrl && data[i].imageUrl.startsWith("data:image/")) {
                data[i].imageUrl = await saveBase64ToFirestore(data[i].imageUrl);
            }
        }
    }`
);

fs.writeFileSync('server.ts', content);
