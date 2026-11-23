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

export const IMPORT_LINK_PREFIX = 'packlight://import';

/** A link that opens Packlight and offers to add the list. Items arrive unpacked. */
export function buildImportLink(list: PackingList): string {
  const items = list.items.slice(0, 150).map((item) => item.text.replace(/\n/g, ' ')).join('\n');
  return `${IMPORT_LINK_PREFIX}?t=${encodeURIComponent(list.title)}&i=${encodeURIComponent(items)}`;
}

/** Reads a packlight://import link (on its own or inside a pasted message). */
export function parseImportLink(input: string): PackingList | null {
  const match = input.match(/packlight:\/\/import\?(\S+)/i);
  if (!match) return null;
  const params: Record<string, string> = {};
  for (const pair of match[1].split('&')) {
    const [key, ...rest] = pair.split('=');
    try {
      params[key] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
    } catch {
      return null;
    }
  }
  const items = (params.i ?? '').split('\n').map((text) => text.trim()).filter(Boolean).slice(0, 150);
  if (items.length === 0) return null;
  const title = (params.t ?? '').trim().slice(0, 60) || 'Shared list';
  return newList(title, items.map((text) => newItem(text)));
}

/** Readable in any messaging app, plus a link that opens straight into Packlight. */
export function formatListForShare(list: PackingList): string {
  const rows = list.items.map((item) => `${item.packed ? '☑' : '☐'} ${item.text}`);
  return [
    `Packing list: ${list.title}`,
    '',
    ...(rows.length > 0 ? rows : ['(No items yet)']),
    '',
    'Open it in Packlight:',
    buildImportLink(list),
  ].join('\n');
}

/** Accepts Packlight shares, markdown checklists, and regular pasted line lists. */
export function parseSharedList(input: string): PackingList | null {
  const fromLink = parseImportLink(input);
  if (fromLink) return fromLink;
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
    if (/^sent from packlight\b/i.test(line) || /^open it in packlight:?$/i.test(line) || /^\(no items yet\)$/i.test(line)) {
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
