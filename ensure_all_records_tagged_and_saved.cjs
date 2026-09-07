const fs = require('fs');
const crypto = require('crypto');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const ENCRYPTION_KEY = crypto.createHash('sha256').update('***REMOVED***').digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return text;
  const parts = trimmed.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  return decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8');
}

async function fix() {
  const raw = fs.readFileSync('local_store.json', 'utf8');
  const store = JSON.parse(decrypt(raw));

  // 1. Tag attendance
  if (Array.isArray(store.attendance)) {
    store.attendance = store.attendance.map(a => ({
      ...a,
      madrasahId: a.madrasahId || 'default',
      madrasahSlug: a.madrasahSlug || 'default'
    }));
  }

  // 2. Tag studentExamGrades
  if (store.studentExamGrades && typeof store.studentExamGrades === 'object') {
    for (const key of Object.keys(store.studentExamGrades)) {
      if (store.studentExamGrades[key]) {
        store.studentExamGrades[key] = {
          ...store.studentExamGrades[key],
          madrasahId: store.studentExamGrades[key].madrasahId || 'default',
          madrasahSlug: store.studentExamGrades[key].madrasahSlug || 'default'
        };
      }
    }
  }

  // 3. Tag completedExams
  if (store.completedExams && typeof store.completedExams === 'object') {
    for (const key of Object.keys(store.completedExams)) {
      if (store.completedExams[key]) {
        store.completedExams[key] = {
          ...store.completedExams[key],
          madrasahId: store.completedExams[key].madrasahId || 'default',
          madrasahSlug: store.completedExams[key].madrasahSlug || 'default'
        };
      }
    }
  }

  // 4. Save to local_store.json
  const encryptedStr = encrypt(JSON.stringify(store, null, 2));
  fs.writeFileSync('local_store.json', encryptedStr, 'utf8');
  fs.writeFileSync('local_store.json.backup', encryptedStr, 'utf8');
  console.log('Successfully updated local_store.json and local_store.json.backup with tagged records!');

  // 5. Save to Firestore
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
    const fbApp = initializeApp(firebaseConfig);
    const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

    if (store.attendance) {
      await setDoc(doc(db, 'app_store', 'attendance'), {
        value: JSON.stringify(store.attendance),
        updatedAt: Date.now()
      });
      console.log('Successfully updated Firestore doc app_store/attendance!');
    }

    if (store.studentExamGrades) {
      await setDoc(doc(db, 'app_store', 'studentExamGrades'), {
        value: JSON.stringify(store.studentExamGrades),
        updatedAt: Date.now()
      });
      console.log('Successfully updated Firestore doc app_store/studentExamGrades!');
    }

    if (store.completedExams) {
      await setDoc(doc(db, 'app_store', 'completedExams'), {
        value: JSON.stringify(store.completedExams),
        updatedAt: Date.now()
      });
      console.log('Successfully updated Firestore doc app_store/completedExams!');
    }
  } catch (err) {
    console.error('Firestore save notice:', err.message);
  }
}

fix();
