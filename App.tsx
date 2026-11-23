import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  cloneList,
  countPacked,
  formatListForShare,
  newItem,
  newList,
  parseSharedList,
  readStoredLists,
  starterList,
  STORAGE_KEY,
  type PackingList,
} from './src/model';

type Dialog = { kind: 'create' | 'rename' | 'import'; listId?: string } | null;

// Baggage-hall palette: cool tarmac fog, navy ink, one high-vis strap yellow
// that only ever means "packed".
const C = {
  fog: '#DCE3E8',
  sheet: '#FFFFFF',
  ink: '#14213D',
  slate: '#6B7686',
  hairline: '#C5CED6',
  strap: '#F2C230',
  strapTrack: '#E6EBEF',
  danger: '#B3261E',
};

// Airport-signage type from fonts built into iOS; condensed sans on Android.
const F = {
  sign: Platform.select({ ios: 'AvenirNextCondensed-Bold', default: 'sans-serif-condensed' }),
  signMedium: Platform.select({ ios: 'AvenirNextCondensed-DemiBold', default: 'sans-serif-condensed' }),
  text: Platform.select({ ios: 'AvenirNext-Regular', default: 'sans-serif' }),
  textMedium: Platform.select({ ios: 'AvenirNext-DemiBold', default: 'sans-serif-medium' }),
};

function niceDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** The strap: a luggage strap that fills with high-vis yellow as items get packed. */
function Strap({ packed, total, thick = false }: { packed: number; total: number; thick?: boolean }) {
  const fraction = total ? (packed / total) * 100 : 0;
  return (
    <View
      style={[styles.strapTrack, thick && styles.strapTrackThick]}
      accessibilityLabel={`${packed} of ${total} items packed`}
    >
      <View style={[styles.strapFill, { width: `${fraction}%` as `${number}%` }]} />
    </View>
  );
}

function ItemRow({
  text,
  packed,
  last,
  onToggle,
  onDelete,
}: {
  text: string;
  packed: boolean;
  last: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.itemRow, !last && styles.rowDivider]}>
      <Pressable
        style={styles.itemMain}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: packed }}
        accessibilityLabel={text}
      >
        <View style={[styles.box, packed && styles.boxPacked]}>
          {packed && <Text style={styles.boxCheck}>✓</Text>}
        </View>
        <Text numberOfLines={3} style={[styles.itemText, packed && styles.itemTextPacked]}>{text}</Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        hitSlop={12}
        style={styles.removeItem}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${text}`}
      >
        <Text style={styles.removeItemText}>×</Text>
      </Pressable>
    </View>
  );
}

function PackingApp() {
  const [lists, setLists] = useState<PackingList[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveIssue, setSaveIssue] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogText, setDialogText] = useState('');
  const [itemText, setItemText] = useState('');
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  const addInputRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const restored = raw === null ? null : readStoredLists(JSON.parse(raw));
        if (alive) setLists(restored ?? [starterList()]);
      } catch {
        if (alive) {
          setLists([starterList()]);
          setSaveIssue(true);
        }
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Serialize writes so a slower previous save can never overwrite a newer one.
  useEffect(() => {
    if (!hydrated) return;
    const serialized = JSON.stringify(lists);
    saves.current = saves.current.catch(() => undefined).then(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, serialized);
        setSaveIssue(false);
      } catch {
        setSaveIssue(true);
      }
    });
  }, [lists, hydrated]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dialog) { setDialog(null); return true; }
      if (selectedId) { setSelectedId(null); setItemText(''); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [dialog, selectedId]);

  const selectedList = lists.find((list) => list.id === selectedId) ?? null;

  const editList = (id: string, updater: (list: PackingList) => PackingList) => {
    setLists((current) => current.map((list) => list.id === id
      ? { ...updater(list), updatedAt: Date.now() }
      : list));
  };

  const showDialog = (kind: 'create' | 'rename' | 'import', listId?: string) => {
    setDialog({ kind, listId });
    setDialogText(kind === 'rename' ? (lists.find((list) => list.id === listId)?.title ?? '') : '');
  };

  const submitDialog = () => {
    if (!dialog) return;
    const text = dialogText.trim();
    if (!text) return;

    if (dialog.kind === 'create') {
      const list = newList(text);
      setLists((current) => [list, ...current]);
      setSelectedId(list.id);
    } else if (dialog.kind === 'rename' && dialog.listId) {
      editList(dialog.listId, (list) => ({ ...list, title: text.slice(0, 60) }));
    } else if (dialog.kind === 'import') {
      const imported = parseSharedList(text);
      if (!imported) {
        Alert.alert('No items found', 'Paste a list with one item per line, or a list shared from Packlight.');
        return;
      }
      setLists((current) => [imported, ...current]);
      setSelectedId(imported.id);
    }
    setDialog(null);
    setDialogText('');
    setItemText('');
  };

  const addItem = () => {
    const text = itemText.trim();
    if (!text || !selectedId) return;
    editList(selectedId, (list) => ({ ...list, items: [...list.items, newItem(text)] }));
    setItemText('');
    addInputRef.current?.focus();
  };

  const shareList = async (list: PackingList) => {
    try {
      await Share.share({
        title: `Packing list: ${list.title}`,
        message: formatListForShare(list),
      });
    } catch {
      Alert.alert('Unable to share', 'Please try sharing the list again.');
    }
  };

  const deleteList = (list: PackingList) => {
    Alert.alert('Delete list?', `“${list.title}” will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          setLists((current) => current.filter((entry) => entry.id !== list.id));
          setSelectedId(null);
        },
      },
    ]);
  };

  const showOptions = (list: PackingList) => {
    // Three buttons per dialog also work on Android (which limits native Alerts to three).
    Alert.alert(list.title, 'What would you like to do?', [
      { text: 'Rename', onPress: () => showDialog('rename', list.id) },
      { text: 'Duplicate', onPress: () => {
        const duplicate = cloneList(list);
        setLists((current) => [duplicate, ...current]);
        setSelectedId(duplicate.id);
        setItemText('');
      } },
      { text: 'More…', onPress: () => {
        Alert.alert('More options', list.title, [
          { text: 'Reset checks', onPress: () => editList(list.id, (current) => ({
            ...current,
            items: current.items.map((item) => ({ ...item, packed: false })),
          })) },
          { text: 'Delete', style: 'destructive', onPress: () => deleteList(list) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } },
    ]);
  };

  const goHome = () => { setSelectedId(null); setItemText(''); };

  if (!hydrated) {
    return (
      <SafeAreaView style={[styles.safe, styles.loading]}>
        <ActivityIndicator size="large" color={C.ink} />
      </SafeAreaView>
    );
  }

  const pending = selectedList?.items.filter((item) => !item.packed) ?? [];
  const finished = selectedList?.items.filter((item) => item.packed) ?? [];
  const packed = selectedList ? countPacked(selectedList) : 0;
  const total = selectedList?.items.length ?? 0;
  const left = total - packed;

  const toggle = (listId: string, itemId: string, value: boolean) => editList(listId, (list) => ({
    ...list, items: list.items.map((current) => current.id === itemId ? { ...current, packed: value } : current),
  }));
  const remove = (listId: string, itemId: string) => editList(listId, (list) => ({
    ...list, items: list.items.filter((current) => current.id !== itemId),
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {!selectedList ? (
        <ScrollView
          contentContainerStyle={styles.homeScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.homeHeader}>
            <Text style={styles.wordmark} accessibilityRole="header">Packlight</Text>
            <Pressable onPress={() => showDialog('import')} hitSlop={10} accessibilityRole="button">
              <Text style={styles.textButton}>Import</Text>
            </Pressable>
          </View>

          {lists.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyHeading}>No lists yet</Text>
              <Text style={styles.emptyText}>Make one for your next trip, or import a list someone sent you.</Text>
            </View>
          ) : (
            <View style={styles.sheet}>
              {lists.map((list, index) => {
                const checked = countPacked(list);
                const count = list.items.length;
                const done = count > 0 && checked === count;
                return (
                  <Pressable
                    key={list.id}
                    onPress={() => setSelectedId(list.id)}
                    style={({ pressed }) => [styles.listRow, index < lists.length - 1 && styles.rowDivider, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${list.title}, ${checked} of ${count} packed`}
                  >
                    <View style={styles.listRowTop}>
                      <Text style={styles.listTitle} numberOfLines={1}>{list.title}</Text>
                      <Text style={[styles.listCount, done && styles.listCountDone]}>
                        {done ? 'Packed' : `${checked}/${count}`}
                      </Text>
                    </View>
                    <Strap packed={checked} total={count} />
                    <Text style={styles.listMeta}>
                      {count === 1 ? '1 item' : `${count} items`}, edited {niceDate(list.updatedAt)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={() => showDialog('create')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>New list</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={styles.detailRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.detailNav}>
            <Pressable onPress={goHome} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to lists">
              <Text style={styles.textButton}>‹ Lists</Text>
            </Pressable>
            <View style={styles.detailNavRight}>
              <Pressable onPress={() => shareList(selectedList)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share this packing list">
                <Text style={styles.textButton}>Share</Text>
              </Pressable>
              <Pressable onPress={() => showOptions(selectedList)} hitSlop={10} accessibilityRole="button" accessibilityLabel="List options">
                <Text style={styles.textButton}>Edit</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.detailTitle} accessibilityRole="header">{selectedList.title}</Text>
            <Strap packed={packed} total={total} thick />
            <Text style={styles.detailStatus}>
              {total === 0 ? 'Add the first thing you need to bring.' :
                left === 0 ? `All ${total} packed. Zip it up.` :
                `${packed} of ${total} packed, ${left} to go`}
            </Text>

            {pending.length > 0 && (
              <View style={styles.sheet}>
                {pending.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    text={item.text}
                    packed={false}
                    last={i === pending.length - 1}
                    onToggle={() => toggle(selectedList.id, item.id, true)}
                    onDelete={() => remove(selectedList.id, item.id)}
                  />
                ))}
              </View>
            )}

            {finished.length > 0 && (
              <>
                <Text style={styles.groupTitle}>In the bag</Text>
                <View style={styles.sheet}>
                  {finished.map((item, i) => (
                    <ItemRow
                      key={item.id}
                      text={item.text}
                      packed
                      last={i === finished.length - 1}
                      onToggle={() => toggle(selectedList.id, item.id, false)}
                      onDelete={() => remove(selectedList.id, item.id)}
                    />
                  ))}
                </View>
              </>
            )}
            {saveIssue && <Text style={styles.saveIssue}>Changes aren't saving on this device. Free up storage and reopen the app.</Text>}
          </ScrollView>

          <View style={styles.addBar}>
            <TextInput
              ref={addInputRef}
              value={itemText}
              onChangeText={setItemText}
              onSubmitEditing={addItem}
              submitBehavior="submit"
              placeholder="Add an item"
              placeholderTextColor={C.slate}
              style={styles.addInput}
              returnKeyType="done"
              autoCorrect
              maxLength={120}
              accessibilityLabel="New packing item"
            />
            <Pressable
              onPress={addItem}
              disabled={!itemText.trim()}
              style={[styles.addButton, !itemText.trim() && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Add item"
            >
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDialog(null)} accessibilityLabel="Close dialog" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCenter}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {dialog?.kind === 'import' ? 'Import a list' : dialog?.kind === 'rename' ? 'Rename list' : 'New list'}
              </Text>
              <Text style={styles.modalCaption}>
                {dialog?.kind === 'import'
                  ? 'Paste a list shared from Packlight, or any list with one item per line.'
                  : 'Name it after the trip.'}
              </Text>
              <TextInput
                autoFocus
                value={dialogText}
                onChangeText={setDialogText}
                placeholder={dialog?.kind === 'import' ? 'Paste here' : 'Lisbon, long weekend'}
                placeholderTextColor={C.slate}
                multiline={dialog?.kind === 'import'}
                numberOfLines={dialog?.kind === 'import' ? 7 : 1}
                maxLength={dialog?.kind === 'import' ? 12000 : 60}
                returnKeyType="done"
                onSubmitEditing={dialog?.kind === 'import' ? undefined : submitDialog}
                style={[styles.modalInput, dialog?.kind === 'import' && styles.modalInputTall]}
              />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setDialog(null)} style={styles.cancelButton} hitSlop={6}>
                  <Text style={styles.textButton}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={submitDialog}
                  disabled={!dialogText.trim()}
                  style={[styles.modalConfirm, !dialogText.trim() && styles.disabled]}
                >
                  <Text style={styles.modalConfirmText}>
                    {dialog?.kind === 'import' ? 'Import' : dialog?.kind === 'rename' ? 'Save' : 'Create list'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PackingApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fog },
  loading: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },

  homeScroll: { paddingHorizontal: 20, paddingBottom: 40 },
  homeHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 28, paddingBottom: 20 },
  wordmark: { fontFamily: F.sign, fontSize: 40, lineHeight: 44, color: C.ink, letterSpacing: -0.5 },
  textButton: { fontFamily: F.textMedium, fontSize: 16, color: C.ink },

  sheet: { backgroundColor: C.sheet, borderRadius: 6, paddingHorizontal: 16, marginBottom: 20 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hairline },

  listRow: { paddingVertical: 16 },
  listRowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  listTitle: { flex: 1, fontFamily: F.signMedium, fontSize: 24, lineHeight: 28, color: C.ink, marginRight: 12 },
  listCount: { fontFamily: F.signMedium, fontSize: 18, color: C.slate, fontVariant: ['tabular-nums'] },
  listCountDone: { color: C.ink },
  listMeta: { fontFamily: F.text, fontSize: 13, color: C.slate, marginTop: 8 },

  strapTrack: { height: 6, borderRadius: 3, backgroundColor: C.strapTrack, overflow: 'hidden' },
  strapTrackThick: { height: 14, borderRadius: 2, backgroundColor: C.sheet },
  strapFill: { height: '100%', backgroundColor: C.strap },

  primaryButton: { height: 54, borderRadius: 6, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: F.textMedium, fontSize: 17, color: C.sheet },

  emptyBox: { paddingVertical: 40 },
  emptyHeading: { fontFamily: F.signMedium, fontSize: 26, color: C.ink },
  emptyText: { fontFamily: F.text, fontSize: 16, lineHeight: 24, color: C.slate, marginTop: 6, maxWidth: 320 },

  detailRoot: { flex: 1 },
  detailNav: { height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailNavRight: { flexDirection: 'row', gap: 22 },
  detailScroll: { paddingHorizontal: 20, paddingBottom: 32 },
  detailTitle: { fontFamily: F.sign, fontSize: 44, lineHeight: 48, color: C.ink, letterSpacing: -0.5, marginTop: 8, marginBottom: 16 },
  detailStatus: { fontFamily: F.text, fontSize: 15, color: C.slate, marginTop: 10, marginBottom: 22 },
  groupTitle: { fontFamily: F.signMedium, fontSize: 18, color: C.slate, marginBottom: 8 },

  itemRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  box: { width: 24, height: 24, borderRadius: 3, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  boxPacked: { backgroundColor: C.strap, borderColor: C.strap },
  boxCheck: { color: C.ink, fontSize: 15, fontWeight: '800', marginTop: -1 },
  itemText: { flex: 1, fontFamily: F.text, fontSize: 17, lineHeight: 23, color: C.ink },
  itemTextPacked: { color: C.slate, textDecorationLine: 'line-through' },
  removeItem: { paddingLeft: 12, paddingVertical: 8 },
  removeItemText: { fontSize: 22, color: C.hairline },
  saveIssue: { fontFamily: F.text, fontSize: 14, color: C.danger, marginTop: 4 },

  addBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: C.fog, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hairline },
  addInput: { flex: 1, height: 48, borderRadius: 6, backgroundColor: C.sheet, paddingHorizontal: 14, fontFamily: F.text, fontSize: 17, color: C.ink },
  addButton: { height: 48, paddingHorizontal: 18, borderRadius: 6, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontFamily: F.textMedium, fontSize: 16, color: C.sheet },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(20, 33, 61, 0.45)', justifyContent: 'center' },
  modalCenter: { paddingHorizontal: 20 },
  modalCard: { backgroundColor: C.sheet, borderRadius: 8, padding: 20 },
  modalTitle: { fontFamily: F.sign, fontSize: 30, color: C.ink },
  modalCaption: { fontFamily: F.text, fontSize: 15, lineHeight: 21, color: C.slate, marginTop: 4, marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: C.hairline, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 12, fontFamily: F.text, fontSize: 17, color: C.ink },
  modalInputTall: { minHeight: 150, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 20, marginTop: 18 },
  cancelButton: { paddingVertical: 10 },
  modalConfirm: { height: 46, paddingHorizontal: 18, borderRadius: 6, backgroundColor: C.ink, justifyContent: 'center' },
  modalConfirmText: { fontFamily: F.textMedium, fontSize: 16, color: C.sheet },
});
