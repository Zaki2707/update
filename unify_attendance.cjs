const fs = require('fs');
const crypto = require('crypto');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');

const ENCRYPTION_KEY = crypto.createHash('sha256').update('***REMOVED***').digest();
function decrypt(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return text;
  const parts = trimmed.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  return decipher.update(parts[1], 'hex', 'utf8') + decipher.final('utf8');
}
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function unifyAllAttendance() {
  const store = JSON.parse(decrypt(fs.readFileSync('local_store.json', 'utf8')));
  const localAtt = store.attendance || [];
  console.log('Local attendance count:', localAtt.length);

  // Get firestore attendance
  let fsAtt = [];
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
    const fbApp = initializeApp(firebaseConfig);
    const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
    const attDoc = await getDoc(doc(db, 'app_store', 'attendance'));
    if (attDoc.exists()) {
      fsAtt = JSON.parse(attDoc.data().value);
      console.log('Firestore attendance count:', fsAtt.length);
    }
  } catch (e) {
    console.warn('Firestore fetch warning:', e.message);
  }

  // Combine by unique key
  const combinedMap = new Map();
  function addRecords(list) {
    list.forEach(a => {
      if (!a) return;
      if (!a.madrasahId) a.madrasahId = 'default';
      if (!a.madrasahSlug) a.madrasahSlug = 'default';
      
      const key = a.id || (String(a.studentId) + '_' + String(a.date) + '_' + String(a.subjectId || ''));
      if (!combinedMap.has(key)) {
        combinedMap.set(key, a);
      } else {
        const existing = combinedMap.get(key);
        combinedMap.set(key, { ...existing, ...a });
      }
    });
  }

  addRecords(localAtt);
  addRecords(fsAtt);

  const merged = Array.from(combinedMap.values());
  console.log('Merged total attendance:', merged.length);

  const byClass = {};
  merged.forEach(a => {
    byClass[a.classId || a.className] = (byClass[a.classId || a.className] || 0) + 1;
  });
  console.log('Attendance by class in merged dataset:', byClass);

  // Update local_store.json
  store.attendance = merged;
  const rawEncrypted = encrypt(JSON.stringify(store, null, 2));
  fs.writeFileSync('local_store.json', rawEncrypted, 'utf8');
  fs.writeFileSync('local_store.json.backup', rawEncrypted, 'utf8');
  console.log('Saved to local_store.json and local_store.json.backup successfully.');

  // Save to Firestore
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
    const fbApp = initializeApp(firebaseConfig);
    const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
    await setDoc(doc(db, 'app_store', 'attendance'), {
      key: 'attendance',
      value: JSON.stringify(merged),
      updatedAt: new Date().toISOString()
    });
    console.log('Saved unified attendance to Firestore app_store/attendance successfully.');
  } catch (e) {
    console.error('Failed to write to Firestore:', e.message);
  }

  process.exit(0);
}

unifyAllAttendance();
