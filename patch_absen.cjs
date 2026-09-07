const fs = require('fs');
let code = fs.readFileSync('src/appScript.js', 'utf8');

const searchHydrationAttendance = "attendance: JSON.parse(localStorage.getItem('madrasah_attendance')) || [\n        { id: 'ATT1', date: '2026-03-24', classId: 'C1', studentId: 'ST1', status: 'HADIR', location: '-6.2000, 106.8166' }\n    ],";
const replaceHydrationAttendance = `attendance: (() => {
        let list = JSON.parse(localStorage.getItem('madrasah_attendance')) || [
            { id: 'ATT1', date: '2026-03-24', classId: 'C1', studentId: 'ST1', status: 'HADIR', location: '-6.2000, 106.8166' }
        ];
        let photos = {};
        try { photos = JSON.parse(localStorage.getItem('madrasah_attendance_photos') || '{}'); } catch(e) {}
        return list.map(item => {
             if (item.photo && item.photo.startsWith('PHOTO_REF:')) {
                 item.photo = photos[item.id] || '';
             }
             return item;
        });
    })(),`;

const searchHydrationTeacherAtt = "teacherAttendance: JSON.parse(localStorage.getItem('madrasah_teacher_attendance')) || [],";
const replaceHydrationTeacherAtt = `teacherAttendance: (() => {
        let list = JSON.parse(localStorage.getItem('madrasah_teacherAttendance')) || JSON.parse(localStorage.getItem('madrasah_teacher_attendance')) || [];
        let photos = {};
        try { photos = JSON.parse(localStorage.getItem('madrasah_teacherAttendance_photos') || '{}'); } catch(e) {}
        return list.map(item => {
             if (item.photo && item.photo.startsWith('PHOTO_REF:')) {
                 item.photo = photos[item.id] || '';
             }
             return item;
        });
    })(),`;

const searchSaveState = `function saveState(key) {
    if (!key || appState[key] === undefined) return;
    safeSetLocalStorage('madrasah_' + key, appState[key]);`;

const replaceSaveState = `function saveState(key) {
    if (!key || appState[key] === undefined) return;
    
    if (key === 'attendance' || key === 'teacherAttendance') {
        try {
            const dataList = appState[key];
            const dataWithoutPhotos = [];
            const photoKey = 'madrasah_' + key + '_photos';
            let photoDict = {};
            try {
                photoDict = JSON.parse(localStorage.getItem(photoKey) || '{}');
            } catch(e) {}
            
            let hasNewPhotos = false;
            for (const item of dataList) {
                const copy = { ...item };
                if (copy.photo && copy.photo.startsWith('data:image')) {
                    photoDict[copy.id] = copy.photo;
                    copy.photo = 'PHOTO_REF:' + copy.id;
                    hasNewPhotos = true;
                }
                dataWithoutPhotos.push(copy);
            }
            
            if (hasNewPhotos) {
                safeSetLocalStorage(photoKey, photoDict);
            }
            safeSetLocalStorage('madrasah_' + key, dataWithoutPhotos);
        } catch(err) {
            console.error('Error separating photo from ' + key, err);
            safeSetLocalStorage('madrasah_' + key, appState[key]);
        }
    } else {
        safeSetLocalStorage('madrasah_' + key, appState[key]);
    }`;

code = code.replace(searchHydrationAttendance, replaceHydrationAttendance);
code = code.replace(searchHydrationTeacherAtt, replaceHydrationTeacherAtt);
code = code.replace(searchSaveState, replaceSaveState);

fs.writeFileSync('src/appScript.js', code);
console.log('Patched src/appScript.js');
