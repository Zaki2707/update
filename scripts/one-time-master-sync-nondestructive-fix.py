from pathlib import Path

p = Path('server.ts')
s = p.read_text(encoding='utf-8')

needle = '''    mergedIncoming.push(merged);
  }

  return [...otherItems, ...mergedIncoming];
}'''

replacement = '''    mergedIncoming.push(merged);
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
}'''

start = s.find('function mergeTenantEntityListData(')
if start < 0:
    raise SystemExit('mergeTenantEntityListData not found')
end = s.find('\n}\n', start)
if end < 0:
    raise SystemExit('mergeTenantEntityListData end not found')
block = s[start:end + 2]
count = block.count(needle)
if count != 1:
    raise SystemExit(f'Expected exactly one destructive merge tail inside mergeTenantEntityListData, found {count}')

patched_block = block.replace(needle, replacement, 1)
s = s[:start] + patched_block + s[end + 2:]
p.write_text(s, encoding='utf-8')
print('Applied non-destructive online master sync guard to server.ts')
