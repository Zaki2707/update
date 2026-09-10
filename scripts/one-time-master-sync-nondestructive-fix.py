from pathlib import Path

p = Path('server.ts')
s = p.read_text(encoding='utf-8')

old = '''  const currentExisting = globalList.filter(item => isItemForCurrentMadrasah(item, req));
  const currentMap = new Map(currentExisting.filter(Boolean).map((item: any) => [String(item.id), item]));
  const otherItems = globalList.filter(item => !isItemForCurrentMadrasah(item, req));
  const mergedIncoming: any[] = [];

  for (const rawItem of incomingData) {
    if (!rawItem || rawItem.id === undefined || rawItem.id === null) continue;
    const existing: any = currentMap.get(String(rawItem.id));
    let merged: any = existing ? { ...existing, ...rawItem } : { ...rawItem };

    if ((kind === 'teacher' || kind === 'student') && existing?.password && !rawItem.password) {
      merged.password = existing.password;
    }

    delete merged.madrasahId;
    delete merged.madrasahSlug;
    merged = tagNewRecord(merged, req);
    mergedIncoming.push(merged);
  }

  return [...otherItems, ...mergedIncoming];
'''

new = '''  const currentExisting = globalList.filter(item => isItemForCurrentMadrasah(item, req));
  const currentMap = new Map(currentExisting.filter(Boolean).map((item: any) => [String(item.id), item]));
  const otherItems = globalList.filter(item => !isItemForCurrentMadrasah(item, req));
  const mergedIncoming: any[] = [];

  for (const rawItem of incomingData) {
    if (!rawItem || rawItem.id === undefined || rawItem.id === null) continue;
    const existing: any = currentMap.get(String(rawItem.id));
    let merged: any = existing ? { ...existing, ...rawItem } : { ...rawItem };

    if ((kind === 'teacher' || kind === 'student') && existing?.password && !rawItem.password) {
      merged.password = existing.password;
    }

    delete merged.madrasahId;
    delete merged.madrasahSlug;
    merged = tagNewRecord(merged, req);
    mergedIncoming.push(merged);
  }

  if (isOnlineMode) {
    // ONLINE is server-authoritative. A browser can legitimately hold only a filtered,
    // stale, or partially loaded list, so omission must NEVER mean deletion.
    // Explicit DELETE endpoints are the only supported destructive path for master data.
    for (const item of mergedIncoming) {
      currentMap.set(String(item.id), item);
    }
    if (mergedIncoming.length < currentExisting.length) {
      console.warn(`[Master Sync Guard] Preserving omitted ${kind} records in online mode (${mergedIncoming.length} incoming, ${currentExisting.length} existing).`);
    }
    return [...otherItems, ...Array.from(currentMap.values())];
  }

  // Preserve legacy offline behavior. Offline CRUD continues to use its local/server flow.
  return [...otherItems, ...mergedIncoming];
'''

count = s.count(old)
if count != 1:
    raise SystemExit(f'Expected exactly one mergeTenantEntityListData block, found {count}')

s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('Applied non-destructive online master sync guard to server.ts')
