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

const C = {
  bg: '#F5F7F2',
  paper: '#FFFFFF',
  ink: '#1D352C',
  muted: '#77867C',
  green: '#286B55',
  greenDark: '#174E3A',
  mint: '#E2EDE5',
  line: '#E5EAE4',
  cream: '#F9EBCF',
  gold: '#DCA44B',
  red: '#AE5C55',
};

function niceDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ProgressBar({ packed, total }: { packed: number; total: number }) {
  const fraction = total ? (packed / total) * 100 : 0;
  return (
    <View style={styles.progressTrack} accessibilityLabel={`${packed} of ${total} items packed`}>
      <View style={[styles.progressFill, { width: `${fraction}%` as `${number}%` }]} />
    </View>
  );
}

function ItemRow({
  text,
  packed,
  onToggle,
  onDelete,
}: {
  text: string;
  packed: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.itemRow}>
      <Pressable
        style={styles.itemMain}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: packed }}
        accessibilityLabel={text}
      >
        <View style={[styles.checkbox, packed && styles.checkboxChecked]}>
          {packed && <Text style={styles.checkmark}>✓</Text>}
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
        <ActivityIndicator size="large" color={C.green} />
        <Text style={styles.loadingText}>Opening your lists…</Text>
      </SafeAreaView>
    );
  }

  const pending = selectedList?.items.filter((item) => !item.packed) ?? [];
  const finished = selectedList?.items.filter((item) => item.packed) ?? [];
  const packed = selectedList ? countPacked(selectedList) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      {!selectedList ? (
        <ScrollView
          contentContainerStyle={styles.homeScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <View style={styles.brandLeft}>
              <View style={styles.brandIcon}><Text style={styles.brandIconText}>✳</Text></View>
              <Text style={styles.brandText}>packlight</Text>
            </View>
            <Pressable onPress={() => showDialog('import')} style={styles.importButton} accessibilityRole="button">
              <Text style={styles.importButtonText}>↓  Import</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.eyebrowWrap}><Text style={styles.eyebrow}>YOUR NEXT ADVENTURE STARTS HERE</Text></View>
            <Text style={styles.heroTitle}>Everything,{"\n"}<Text style={styles.heroAccent}>remembered.</Text></Text>
            <Text style={styles.heroCaption}>Less forgetting. More going.</Text>
            <Pressable onPress={() => showDialog('create')} style={styles.primaryButton} accessibilityRole="button">
              <Text style={styles.primaryButtonText}>＋  New packing list</Text>
              <Text style={styles.primaryButtonArrow}>↗</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Your lists</Text>
            <Text style={styles.sectionCount}>{lists.length} {lists.length === 1 ? 'LIST' : 'LISTS'}</Text>
          </View>

          {lists.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🧳</Text>
              <Text style={styles.emptyHeading}>Your bags are empty.</Text>
              <Text style={styles.emptyText}>Create your first list, or import one from a friend.</Text>
              <Pressable onPress={() => showDialog('create')} style={styles.emptyAction}>
                <Text style={styles.emptyActionText}>Make a list  →</Text>
              </Pressable>
            </View>
          ) : (
            lists.map((list, index) => {
              const checked = countPacked(list);
              return (
                <Pressable
                  key={list.id}
                  onPress={() => setSelectedId(list.id)}
                  style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${list.title}, ${checked} of ${list.items.length} packed`}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.tripIcon, index % 3 === 1 && styles.tripIconMint]}>
                      <Text style={styles.tripIconEmoji}>{index % 3 === 1 ? '🌴' : '🧳'}</Text>
                    </View>
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{list.title}</Text>
                      <Text style={styles.cardSubtitle}>Edited {niceDate(list.updatedAt)} · {list.items.length} items</Text>
                    </View>
                    <Text style={styles.cardChevron}>›</Text>
                  </View>
                  <View style={styles.cardBottom}>
                    <ProgressBar packed={checked} total={list.items.length} />
                    <Text style={styles.cardProgress}>{checked}/{list.items.length} packed</Text>
                  </View>
                </Pressable>
              );
            })
          )}
          <View style={styles.footerMark}><Text style={styles.footerText}>Made for the journey, not the baggage. ✳</Text></View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={styles.detailRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.detailNav}>
            <Pressable onPress={goHome} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to lists">
              <Text style={styles.backIcon}>‹</Text><Text style={styles.backText}>Lists</Text>
            </Pressable>
            <View style={styles.detailNavRight}>
              <Pressable onPress={() => shareList(selectedList)} style={styles.shareButton} accessibilityRole="button" accessibilityLabel="Share this packing list">
                <Text style={styles.shareButtonText}>↗  Share</Text>
              </Pressable>
              <Pressable onPress={() => showOptions(selectedList)} style={styles.moreButton} accessibilityRole="button" accessibilityLabel="List options">
                <Text style={styles.moreButtonText}>···</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.detailScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.detailIntro}>
              <Text style={styles.detailKicker}>PACKING CHECKLIST</Text>
              <Text style={styles.detailTitle}>{selectedList.title}</Text>
              <Text style={styles.detailSubheading}>
                {selectedList.items.length === 0 ? 'Add a few things to get started.' :
                  packed === selectedList.items.length ? 'You’re all packed. Have a great trip!' :
                  `${selectedList.items.length - packed} ${selectedList.items.length - packed === 1 ? 'thing' : 'things'} left to pack.`}
              </Text>
            </View>

            <View style={styles.detailProgressCard}>
              <View style={styles.detailProgressHeader}>
                <Text style={styles.detailProgressLabel}>PACKING PROGRESS</Text>
                <Text style={styles.detailProgressNumber}>{selectedList.items.length > 0 ? Math.round((packed / selectedList.items.length) * 100) : 0}%</Text>
              </View>
              <ProgressBar packed={packed} total={selectedList.items.length} />
              <Text style={styles.detailProgressFoot}>{packed} of {selectedList.items.length} packed</Text>
            </View>

            <View style={styles.groupTitleRow}>
              <Text style={styles.groupTitle}>To pack</Text>
              <View style={styles.groupBadge}><Text style={styles.groupBadgeText}>{pending.length}</Text></View>
            </View>
            {pending.length > 0 ? (
              <View style={styles.itemGroup}>
                {pending.map((item) => (
                  <ItemRow
                    key={item.id}
                    text={item.text}
                    packed={false}
                    onToggle={() => editList(selectedList.id, (list) => ({
                      ...list, items: list.items.map((current) => current.id === item.id ? { ...current, packed: true } : current),
                    }))}
                    onDelete={() => editList(selectedList.id, (list) => ({
                      ...list, items: list.items.filter((current) => current.id !== item.id),
                    }))}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.groupEmpty}>
                <Text style={styles.groupEmptyText}>{selectedList.items.length ? '✓  All items packed!' : 'Your checklist starts here.'}</Text>
              </View>
            )}

            {finished.length > 0 && (
              <>
                <View style={styles.groupTitleRow}>
                  <Text style={styles.groupTitle}>Packed</Text>
                  <View style={styles.groupBadge}><Text style={styles.groupBadgeText}>{finished.length}</Text></View>
                </View>
                <View style={styles.itemGroup}>
                  {finished.map((item) => (
                    <ItemRow
                      key={item.id}
                      text={item.text}
                      packed
                      onToggle={() => editList(selectedList.id, (list) => ({
                        ...list, items: list.items.map((current) => current.id === item.id ? { ...current, packed: false } : current),
                      }))}
                      onDelete={() => editList(selectedList.id, (list) => ({
                        ...list, items: list.items.filter((current) => current.id !== item.id),
                      }))}
                    />
                  ))}
                </View>
              </>
            )}
            <Text style={styles.autoSaveLabel}>{saveIssue ? '⚠ Unable to save changes on this device' : '✓  Changes save automatically on this device'}</Text>
          </ScrollView>

          <View style={styles.addBar}>
            <TextInput
              ref={addInputRef}
              value={itemText}
              onChangeText={setItemText}
              onSubmitEditing={addItem}
              placeholder="Add an item…"
              placeholderTextColor="#9AABA0"
              style={styles.addInput}
              returnKeyType="done"
              autoCorrect
              maxLength={120}
              accessibilityLabel="New packing item"
            />
            <Pressable
              onPress={addItem}
              disabled={!itemText.trim()}
              style={[styles.addButton, !itemText.trim() && styles.addButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Add item"
            >
              <Text style={styles.addButtonText}>＋</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDialog(null)} accessibilityLabel="Close dialog" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCenter}>
            <View style={styles.modalCard}>
              <Text style={styles.modalKicker}>
                {dialog?.kind === 'import' ? 'FROM A FRIEND' : dialog?.kind === 'rename' ? 'A FRESH NAME' : 'LET’S GET PACKING'}
              </Text>
              <Text style={styles.modalTitle}>
                {dialog?.kind === 'import' ? 'Import a list' : dialog?.kind === 'rename' ? 'Rename list' : 'Name your trip'}
              </Text>
              <Text style={styles.modalCaption}>
                {dialog?.kind === 'import'
                  ? 'Paste a shared Packlight list, or any checklist with one item per line.'
                  : 'You can change this later.'}
              </Text>
              <TextInput
                autoFocus
                value={dialogText}
                onChangeText={setDialogText}
                placeholder={dialog?.kind === 'import' ? 'Paste list here…' : 'e.g. Paris weekend'}
                placeholderTextColor="#9AA99F"
                multiline={dialog?.kind === 'import'}
                numberOfLines={dialog?.kind === 'import' ? 7 : 1}
                maxLength={dialog?.kind === 'import' ? 12000 : 60}
                returnKeyType="done"
                onSubmitEditing={dialog?.kind === 'import' ? undefined : submitDialog}
                style={[styles.modalInput, dialog?.kind === 'import' && styles.modalInputTall]}
              />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setDialog(null)} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={submitDialog} disabled={!dialogText.trim()} style={[styles.modalConfirm, !dialogText.trim() && styles.addButtonDisabled]}>
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
  safe: { flex: 1, backgroundColor: C.bg },
  loading: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, marginTop: 15, color: C.muted },
  homeScroll: { paddingHorizontal: 24, paddingBottom: 38 },
  brandRow: { height: 78, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.green },
  brandIconText: { fontSize: 19, fontWeight: '800', color: 'white', marginTop: -1 },
  brandText: { fontSize: 22, color: C.ink, fontWeight: '800', letterSpacing: -0.8 },
  importButton: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.mint },
  importButtonText: { fontSize: 13, fontWeight: '700', color: C.green },
  hero: { paddingTop: 36, paddingBottom: 39 },
  eyebrowWrap: { alignSelf: 'flex-start', backgroundColor: C.cream, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  eyebrow: { fontSize: 9, fontWeight: '800', color: '#8A673A', letterSpacing: 1.25 },
  heroTitle: { color: C.ink, fontSize: 44, fontWeight: '800', letterSpacing: -2.1, lineHeight: 51, marginTop: 20 },
  heroAccent: { color: C.green },
  heroCaption: { color: C.muted, fontSize: 16, marginTop: 13 },
  primaryButton: { backgroundColor: C.green, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, height: 58, borderRadius: 18, marginTop: 28 },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  primaryButtonArrow: { color: 'white', fontSize: 23, fontWeight: '400' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 23, fontWeight: '800', letterSpacing: -0.7, color: C.ink },
  sectionCount: { color: C.muted, fontWeight: '800', fontSize: 10, letterSpacing: 1.25 },
  listCard: { backgroundColor: C.paper, borderRadius: 22, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#ECF0EA', shadowColor: '#1B3B31', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  pressed: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  tripIcon: { width: 51, height: 51, borderRadius: 17, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream },
  tripIconMint: { backgroundColor: C.mint },
  tripIconEmoji: { fontSize: 24 },
  cardText: { flex: 1, paddingLeft: 13 },
  cardTitle: { color: C.ink, fontWeight: '800', fontSize: 16, letterSpacing: -0.25 },
  cardSubtitle: { fontSize: 12, color: C.muted, marginTop: 5 },
  cardChevron: { color: '#97A99D', fontSize: 31, marginLeft: 6, marginTop: -5 },
  cardBottom: { marginTop: 20 },
  progressTrack: { height: 7, borderRadius: 10, backgroundColor: '#E8EEE8', overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 10, backgroundColor: C.green },
  cardProgress: { fontSize: 11, color: C.muted, textAlign: 'right', marginTop: 8, fontWeight: '600' },
  emptyBox: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CDD9CE', paddingHorizontal: 24, paddingVertical: 32, borderRadius: 20, alignItems: 'center' },
  emptyEmoji: { fontSize: 33 },
  emptyHeading: { color: C.ink, fontWeight: '800', fontSize: 17, marginTop: 12 },
  emptyText: { textAlign: 'center', color: C.muted, lineHeight: 22, marginTop: 7 },
  emptyAction: { padding: 12, marginTop: 12 },
  emptyActionText: { color: C.green, fontWeight: '800' },
  footerMark: { marginTop: 25, alignItems: 'center' },
  footerText: { color: '#A3B0A6', fontSize: 11 },
  detailRoot: { flex: 1 },
  detailNav: { height: 67, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 23 },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  backIcon: { color: C.green, fontSize: 34, lineHeight: 37, marginTop: -5 },
  backText: { color: C.green, fontSize: 15, fontWeight: '700', marginLeft: 3 },
  detailNavRight: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  shareButton: { backgroundColor: C.green, paddingHorizontal: 15, height: 37, justifyContent: 'center', borderRadius: 12 },
  shareButtonText: { color: 'white', fontSize: 13, fontWeight: '800' },
  moreButton: { backgroundColor: C.mint, height: 37, width: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moreButtonText: { color: C.green, fontSize: 25, lineHeight: 27, fontWeight: '800', marginTop: -9 },
  detailScroll: { paddingHorizontal: 23, paddingBottom: 36 },
  detailIntro: { paddingTop: 22, paddingBottom: 22 },
  detailKicker: { fontSize: 10, fontWeight: '800', color: C.green, letterSpacing: 2 },
  detailTitle: { color: C.ink, fontSize: 37, fontWeight: '800', letterSpacing: -1.8, lineHeight: 44, marginTop: 10 },
  detailSubheading: { color: C.muted, fontSize: 15, marginTop: 9 },
  detailProgressCard: { backgroundColor: C.mint, borderRadius: 20, padding: 20 },
  detailProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  detailProgressLabel: { fontSize: 10, color: C.green, letterSpacing: 1.3, fontWeight: '800' },
  detailProgressNumber: { color: C.greenDark, fontSize: 24, fontWeight: '800' },
  detailProgressFoot: { fontSize: 11, color: C.green, marginTop: 9, fontWeight: '600' },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 26, marginBottom: 13 },
  groupTitle: { color: C.ink, fontSize: 20, letterSpacing: -0.5, fontWeight: '800' },
  groupBadge: { backgroundColor: C.mint, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  groupBadgeText: { color: C.green, fontSize: 11, fontWeight: '800' },
  itemGroup: { backgroundColor: C.paper, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#EEF1EC' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 15, minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingTop: 14, paddingBottom: 14 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.8, borderColor: '#BAC9BD', backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: C.green, borderColor: C.green },
  checkmark: { color: 'white', fontSize: 15, fontWeight: '800', lineHeight: 21 },
  itemText: { flex: 1, color: C.ink, fontSize: 15, marginLeft: 13, lineHeight: 21 },
  itemTextPacked: { color: '#98A59B', textDecorationLine: 'line-through' },
  removeItem: { width: 31, height: 34, alignItems: 'center', justifyContent: 'center' },
  removeItemText: { color: '#B5C0B6', fontSize: 23, fontWeight: '300' },
  groupEmpty: { alignItems: 'center', paddingVertical: 24, borderRadius: 18, borderColor: '#D6DED5', borderWidth: 1, borderStyle: 'dashed' },
  groupEmptyText: { color: C.muted, fontSize: 13 },
  autoSaveLabel: { textAlign: 'center', color: '#9BA99D', fontSize: 11, marginTop: 30, lineHeight: 17 },
  addBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 9, paddingHorizontal: 23, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  addInput: { flex: 1, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 15, height: 48, paddingHorizontal: 16, color: C.ink, fontSize: 15 },
  addButton: { width: 49, height: 49, borderRadius: 15, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  addButtonDisabled: { opacity: 0.45 },
  addButtonText: { fontSize: 26, color: 'white', fontWeight: '400', lineHeight: 31 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(16, 33, 26, 0.42)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCenter: { width: '100%' },
  modalCard: { backgroundColor: C.paper, borderRadius: 26, padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  modalKicker: { color: C.green, fontSize: 10, letterSpacing: 1.6, fontWeight: '800' },
  modalTitle: { color: C.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.8, marginTop: 9 },
  modalCaption: { color: C.muted, lineHeight: 21, marginTop: 9, marginBottom: 19 },
  modalInput: { height: 52, borderWidth: 1.5, borderColor: '#D9E4DB', borderRadius: 13, padding: 13, fontSize: 16, color: C.ink, backgroundColor: '#FCFDFC' },
  modalInputTall: { height: 175, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 19 },
  cancelButton: { borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, justifyContent: 'center' },
  cancelText: { color: C.muted, fontWeight: '700' },
  modalConfirm: { backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 19, paddingVertical: 12, justifyContent: 'center' },
  modalConfirmText: { color: 'white', fontWeight: '800' },
});
