import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

function replaceEndpoint(endpointSignature, handlerContentReplaceFn) {
    const idx = content.indexOf(endpointSignature);
    if (idx === -1) {
        console.log("Could not find:", endpointSignature);
        return;
    }
    // Simple approach: we just replace a specific substring inside the endpoint block.
}

// 1. POST /api/students
content = content.replace(
  'const { nis, name, classId, username, password, photo, no_hp } = req.body;',
  'let { nis, name, classId, username, password, photo, no_hp } = req.body;\n  if (photo && photo.startsWith("data:image/")) { photo = await saveBase64ToFirestore(photo); }'
);

// 2. PUT /api/students/:id
content = content.replace(
  'const { nis, name, classId, username, password, photo, no_hp, role } = req.body;',
  'let { nis, name, classId, username, password, photo, no_hp, role } = req.body;\n  if (photo && photo.startsWith("data:image/")) { photo = await saveBase64ToFirestore(photo); }'
);

// 3. PUT /api/teachers/:id
// Teachers might update photo? Let's check if there is a photo field in teacher update.
content = content.replace(
  'homeroom_class_id: req.body.homeroom_class_id ?? t.homeroom_class_id\n  };',
  'homeroom_class_id: req.body.homeroom_class_id ?? t.homeroom_class_id,\n    photo: (req.body.photo && req.body.photo.startsWith("data:image/")) ? await saveBase64ToFirestore(req.body.photo) : (req.body.photo !== undefined ? req.body.photo : t.photo)\n  };'
);

// 4. POST /api/teachers
// Add photo support if not there
content = content.replace(
  'const { nip, name, username, password, mapel, homeroom_class_id } = req.body;',
  'let { nip, name, username, password, mapel, homeroom_class_id, photo } = req.body;\n  if (photo && photo.startsWith("data:image/")) { photo = await saveBase64ToFirestore(photo); }'
);
content = content.replace(
  'homeroom_class_id: homeroom_class_id || ""\n  };',
  'homeroom_class_id: homeroom_class_id || "",\n    photo: photo || ""\n  };'
);

// 5. POST /api/questions and PUT /api/questions/:id
// Usually images in questions are stored as imageUrl, or image. Let's check req.body in questions API.
content = content.replace(
  'const { question, options, optionA, optionB, optionC, optionD, optionE, answer, subjectId, classId, code, type, explanation } = req.body;',
  'let { question, options, optionA, optionB, optionC, optionD, optionE, answer, subjectId, classId, code, type, explanation, imageUrl } = req.body;\n  if (imageUrl && imageUrl.startsWith("data:image/")) { imageUrl = await saveBase64ToFirestore(imageUrl); }'
);

content = content.replace(
  'explanation: explanation || ""\n  };',
  'explanation: explanation || "",\n    imageUrl: imageUrl || ""\n  };'
);

// PUT /api/questions/:id
content = content.replace(
  '...questions[idx],\n    question: req.body.question ?? questions[idx].question,',
  '...questions[idx],\n    imageUrl: (req.body.imageUrl && req.body.imageUrl.startsWith("data:image/")) ? await saveBase64ToFirestore(req.body.imageUrl) : (req.body.imageUrl !== undefined ? req.body.imageUrl : questions[idx].imageUrl),\n    question: req.body.question ?? questions[idx].question,'
);

fs.writeFileSync('server.ts', content);
console.log("server.ts updated");
