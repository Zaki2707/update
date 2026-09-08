from pathlib import Path

p = Path('server.ts')
s = p.read_text()

replacements = [
    (
        "        if (dbData['attendance'] !== undefined) attendance = dbData['attendance'];",
        """        if (dbData['attendance'] !== undefined) {
          const archives: any[] = [];
          Object.keys(dbData).forEach(k => {
            if (k.startsWith('attendance_archive_') && Array.isArray(dbData[k])) archives.push(...dbData[k]);
          });
          attendance = mergeArrays(dbData['attendance'] || [], archives, 'attendance');
        }""",
    ),
    (
        "        if (dbData['chats'] !== undefined) chats = dbData['chats'];",
        """        if (dbData['chats'] !== undefined) {
          const archives: any[] = [];
          Object.keys(dbData).forEach(k => {
            if (k.startsWith('chats_archive_') && Array.isArray(dbData[k])) archives.push(...dbData[k]);
          });
          chats = mergeArrays(dbData['chats'] || [], archives, 'chats');
        }""",
    ),
    (
        "        if (dbData['teacherAttendance'] !== undefined) teacherAttendance = dbData['teacherAttendance'];",
        """        if (dbData['teacherAttendance'] !== undefined) {
          const archives: any[] = [];
          Object.keys(dbData).forEach(k => {
            if (k.startsWith('teacherAttendance_archive_') && Array.isArray(dbData[k])) archives.push(...dbData[k]);
          });
          teacherAttendance = mergeArrays(dbData['teacherAttendance'] || [], archives, 'teacherAttendance');
        }""",
    ),
]

for old, new in replacements:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one refresh statement, found {count}: {old}')
    s = s.replace(old, new, 1)

marker = "        if (dbData['childguardStatus'] !== undefined) childguardStatus = dbData['childguardStatus'];\n\n        lastDbFetchTime = Date.now();"
replacement = "        if (dbData['childguardStatus'] !== undefined) childguardStatus = dbData['childguardStatus'];\n        applyExtendedDbState(dbData);\n\n        lastDbFetchTime = Date.now();"
if s.count(marker) != 1:
    raise SystemExit(f'Expected exactly one refresh extended-state marker, found {s.count(marker)}')
s = s.replace(marker, replacement, 1)

p.write_text(s)
