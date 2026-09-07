import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// The `POST /api/sync-state` is quite big. Let's just use string replacement.
content = content.replace(
  "app.post(\"/api/sync-state\", async (req, res) => {",
  `app.post("/api/sync-state", async (req, res) => {
  try {
    const { key, data } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key required" });
    
    // Process base64 uploads for students
    if (key === 'students' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for teachers
    if (key === 'teachers' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for questions
    if ((key === 'questions' || key === 'questionBank') && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].imageUrl && data[i].imageUrl.startsWith("data:image/")) {
                data[i].imageUrl = await saveBase64ToFirestore(data[i].imageUrl);
            }
        }
    }
`
);

// We need to match the previous try/catch to remove the duplicate
content = content.replace(
  `app.post("/api/sync-state", async (req, res) => {
  try {
    const { key, data } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key required" });
    
    // Process base64 uploads for students
    if (key === 'students' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for teachers
    if (key === 'teachers' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for questions
    if ((key === 'questions' || key === 'questionBank') && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].imageUrl && data[i].imageUrl.startsWith("data:image/")) {
                data[i].imageUrl = await saveBase64ToFirestore(data[i].imageUrl);
            }
        }
    }
  try {
    const { key, data } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key required" });`,
  `app.post("/api/sync-state", async (req, res) => {
  try {
    const { key, data } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key required" });
    
    // Process base64 uploads for students
    if (key === 'students' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for teachers
    if (key === 'teachers' && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
                data[i].photo = await saveBase64ToFirestore(data[i].photo);
            }
        }
    }
    // Process base64 uploads for questions
    if ((key === 'questions' || key === 'questionBank') && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] && data[i].imageUrl && data[i].imageUrl.startsWith("data:image/")) {
                data[i].imageUrl = await saveBase64ToFirestore(data[i].imageUrl);
            }
        }
    }`
);

fs.writeFileSync('server.ts', content);
