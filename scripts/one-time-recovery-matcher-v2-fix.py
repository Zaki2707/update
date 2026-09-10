from pathlib import Path

p = Path("server.ts")
s = p.read_text(encoding="utf-8")

old_matcher = r"""  const sameLogicalRecord = (kind: string, a: any, b: any) => {
    if (!a || !b) return false;
    if (a.id !== undefined && a.id !== null && b.id !== undefined && b.id !== null && String(a.id) === String(b.id)) return true;
    const n = (v: any) => String(v ?? '').trim().toLowerCase();
    if (kind === 'students') {
      if (n(a.username) && n(a.username) === n(b.username)) return true;
      if (n(a.nis) && n(a.nis) === n(b.nis)) return true;
    } else if (kind === 'teachers') {
      if (n(a.username) && n(a.username) === n(b.username)) return true;
      if (n(a.nip) && n(a.nip) === n(b.nip)) return true;
    } else if (kind === 'classes' || kind === 'subjects') {
      if (n(a.code) && n(a.code) === n(b.code)) return true;
      if (n(a.name) && n(a.name) === n(b.name)) return true;
    }
    return false;
  };
"""

new_matcher = r"""  const normalizeRecoveryIdentity = (v: any) => String(v ?? '').trim().toLowerCase();

  // Recovery matching is deliberately strict:
  // 1) exact ID always wins;
  // 2) otherwise require a compound identity, never a single loose field.
  // This prevents one current record from hiding a different missing backup record.
  const sameRecoveryIdentity = (kind: string, a: any, b: any) => {
    if (!a || !b) return false;

    if (
      a.id !== undefined && a.id !== null &&
      b.id !== undefined && b.id !== null &&
      String(a.id) === String(b.id)
    ) {
      return true;
    }

    const n = normalizeRecoveryIdentity;
    if (kind === 'students') {
      return Boolean(
        n(a.username) && n(a.nis) &&
        n(a.username) === n(b.username) &&
        n(a.nis) === n(b.nis)
      );
    }
    if (kind === 'teachers') {
      return Boolean(
        n(a.username) && n(a.nip) &&
        n(a.username) === n(b.username) &&
        n(a.nip) === n(b.nip)
      );
    }
    if (kind === 'subjects') {
      return Boolean(
        n(a.code) && n(a.name) &&
        n(a.code) === n(b.code) &&
        n(a.name) === n(b.name)
      );
    }
    if (kind === 'classes') {
      if (n(a.code) && n(b.code)) {
        return Boolean(
          n(a.name) &&
          n(a.code) === n(b.code) &&
          n(a.name) === n(b.name)
        );
      }
      // Some legacy classes do not have code; in that case require name + grade.
      return Boolean(
        n(a.name) && n(a.grade) &&
        n(a.name) === n(b.name) &&
        n(a.grade) === n(b.grade)
      );
    }
    return false;
  };

  const findUnusedExistingRecoveryMatch = (
    kind: string,
    item: any,
    existing: any[],
    usedExistingIndexes: Set<number>
  ) => {
    // Pass 1: exact ID.
    for (let i = 0; i < existing.length; i++) {
      if (usedExistingIndexes.has(i)) continue;
      const cur = existing[i];
      if (
        cur &&
        item?.id !== undefined && item?.id !== null &&
        cur.id !== undefined && cur.id !== null &&
        String(item.id) === String(cur.id)
      ) {
        return i;
      }
    }

    // Pass 2: strict compound logical identity.
    for (let i = 0; i < existing.length; i++) {
      if (usedExistingIndexes.has(i)) continue;
      if (sameRecoveryIdentity(kind, item, existing[i])) return i;
    }
    return -1;
  };
"""

if old_matcher not in s:
    raise SystemExit("old recovery matcher block not found")
s = s.replace(old_matcher, new_matcher, 1)

old_plan = r"""    const existing = currentByKind[kind].filter(item => isItemForCurrentMadrasah(item, req));
    const missing: any[] = [];
    for (const raw of incoming) {
      const item = sanitizeRecoveredRecord(kind, raw);
      if (!item) continue;
      if (existing.some(cur => sameLogicalRecord(kind, item, cur))) continue;
      if (missing.some(cur => sameLogicalRecord(kind, item, cur))) continue;
      missing.push(item);
    }
    plan[kind] = missing;
"""

new_plan = r"""    const existing = currentByKind[kind].filter(item => isItemForCurrentMadrasah(item, req));
    const usedExistingIndexes = new Set<number>();
    const missing: any[] = [];

    for (const raw of incoming) {
      const item = sanitizeRecoveredRecord(kind, raw);
      if (!item) continue;

      const matchedIndex = findUnusedExistingRecoveryMatch(
        kind,
        item,
        existing,
        usedExistingIndexes
      );
      if (matchedIndex >= 0) {
        usedExistingIndexes.add(matchedIndex);
        continue;
      }

      // De-duplicate only genuinely identical incoming recovery records.
      if (missing.some(cur => sameRecoveryIdentity(kind, item, cur))) continue;
      missing.push(item);
    }
    plan[kind] = missing;
"""

if old_plan not in s:
    raise SystemExit("old recovery plan loop not found")
s = s.replace(old_plan, new_plan, 1)

count_v1 = s.count("master-recovery-missing-only-v1")
if count_v1 != 2:
    raise SystemExit(f"expected 2 v1 capability markers, found {count_v1}")
s = s.replace("master-recovery-missing-only-v1", "master-recovery-missing-only-v2")

p.write_text(s, encoding="utf-8")
print("Applied strict one-to-one recovery matcher v2")
