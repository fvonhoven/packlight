export type PackingItem = {
  id: string;
  text: string;
  packed: boolean;
};

export type PackingList = {
  id: string;
  title: string;
  items: PackingItem[];
  createdAt: number;
  updatedAt: number;
};

export const STORAGE_KEY = '@packlight/lists-v1';

export const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function newItem(text: string, packed = false): PackingItem {
  return { id: createId(), text: text.trim().slice(0, 120), packed };
}

export function newList(title: string, items: PackingItem[] = []): PackingList {
  const now = Date.now();
  return {
    id: createId(),
    title: title.trim().slice(0, 60) || 'Untitled list',
    items,
    createdAt: now,
    updatedAt: now,
  };
}

export function starterList(): PackingList {
  return newList('Weekend away', [
    'Wallet & ID',
    'Phone charger',
    'Toothbrush',
    'Toiletries',
    'Clothes',
    'Underwear & socks',
    'Sleepwear',
    'Medication',
    'Headphones',
  ].map((text) => newItem(text)));
}

export function countPacked(list: PackingList): number {
  return list.items.filter((item) => item.packed).length;
}

export function cloneList(list: PackingList): PackingList {
  return newList(`${list.title} (copy)`, list.items.map((item) => newItem(item.text)));
}

/** Text-based sharing works in Messages, Mail, WhatsApp, etc. No server needed. */
export function formatListForShare(list: PackingList): string {
  const rows = list.items.map((item) => `${item.packed ? '☑' : '☐'} ${item.text}`);
  return [
    `PACKING LIST: ${list.title}`,
    '',
    ...(rows.length > 0 ? rows : ['(No items yet)']),
    '',
    'Sent from Packlight. To save a copy, paste this message into Packlight → Import.',
  ].join('\n');
}

/** Accepts Packlight shares, markdown checklists, and regular pasted line lists. */
export function parseSharedList(input: string): PackingList | null {
  const lines = input.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim());
  let title = 'Imported list';
  const items: PackingItem[] = [];

  for (const line of lines) {
    if (!line) continue;

    const titleMatch = line.match(/^packing list\s*:\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim() || title;
      continue;
    }
    if (/^sent from packlight\b/i.test(line) || /^\(no items yet\)$/i.test(line)) {
      continue;
    }

    const checkbox = line.match(/^(☑|☐|✅|⬜|☒|✓|✔|◻|□)\s+(.+)$/u);
    const markdown = line.match(/^[-*]\s+\[([xX ])\]\s+(.+)$/);
    const bullet = line.match(/^(?:[-*•]\s+|\d+[.)]\s+)(.+)$/);

    let text: string;
    let packed = false;

    if (checkbox) {
      packed = ['☑', '✅', '☒', '✓', '✔'].includes(checkbox[1]);
      text = checkbox[2];
    } else if (markdown) {
      packed = markdown[1].toLowerCase() === 'x';
      text = markdown[2];
    } else if (bullet) {
      text = bullet[1];
    } else {
      text = line;
    }

    if (text.trim()) items.push(newItem(text, packed));
    if (items.length >= 150) break;
  }

  return items.length > 0 ? newList(title, items) : null;
}

/** Defensive parsing, including preserving a deliberately empty list collection. */
export function readStoredLists(value: unknown): PackingList[] | null {
  if (!Array.isArray(value)) return null;
  const result: PackingList[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const candidate = entry as Partial<PackingList>;
    if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string' || !Array.isArray(candidate.items)) {
      continue;
    }
    const items: PackingItem[] = [];
    for (const item of candidate.items) {
      if (typeof item !== 'object' || item === null) continue;
      const obj = item as Partial<PackingItem>;
      if (typeof obj.id !== 'string' || typeof obj.text !== 'string') continue;
      items.push({ id: obj.id, text: obj.text.slice(0, 120), packed: obj.packed === true });
    }
    result.push({
      id: candidate.id,
      title: candidate.title.slice(0, 60),
      items,
      createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
      updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
    });
  }
  return result;
}
