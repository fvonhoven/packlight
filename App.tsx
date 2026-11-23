import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  LayoutAnimation,
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

/** The strap: a luggage strap that springs forward in high-vis yellow as items get packed. */
function Strap({ packed, total, thick = false }: { packed: number; total: number; thick?: boolean }) {
  const fraction = total ? packed / total : 0;
  const anim = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: fraction, friction: 6, tension: 70, useNativeDriver: false }).start();
  }, [anim, fraction]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View
      style={[styles.strapTrack, thick && styles.strapTrackThick]}
      accessibilityLabel={`${packed} of ${total} items packed`}
    >
      <Animated.View style={[styles.strapFill, { width }]} />
    </View>
  );
}

/** Baggage-handler stamp that thumps onto a fully packed list. */
function PackedStamp() {
  const drop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(drop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [drop]);
  const scale = drop.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.stamp, { opacity: drop, transform: [{ rotate: '-9deg' }, { scale }] }]}
      accessibilityLabel="Everything is packed"
    >
      <Text style={styles.stampText}>PACKED</Text>
    </Animated.View>
  );
}

function statusLine(packed: number, total: number): string {
  const remaining = total - packed;
  if (total === 0) return 'Empty bag. Add the first thing you need.';
  if (remaining === 0) return 'Everything is in. Zip it up.';
  if (packed === 0) return `${total} things to pack. Start anywhere.`;
  if (remaining === 1) return 'One more. Don\'t forget it.';
  if (packed / total < 0.5) return `${packed} in, ${remaining} to go.`;
  return `${remaining} left. Nearly there.`;
}

function ItemRow({
  text,
  packed,
  last,
  pop,
  onToggle,
  onRemove,
}: {
  text: string;
  packed: boolean;
  last: boolean;
  pop: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  // Rows remount when they move between sections, so the pop plays on mount.
  const scale = useRef(new Animated.Value(pop ? 0.4 : 1)).current;
  useEffect(() => {
    if (pop) Animated.spring(scale, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start();
  }, [pop, scale]);
  return (
    <View style={[styles.itemRow, !last && styles.rowDivider]}>
      <Pressable
        onPress={onToggle}
        hitSlop={{ top: 10, bottom: 10, left: 12, right: 10 }}
        style={({ pressed }) => [styles.boxHit, pressed && styles.pressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: packed }}
        accessibilityLabel={text}
        accessibilityActions={[{ name: 'remove', label: 'Remove' }]}
        onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'remove') onRemove(); }}
      >
        <Animated.View style={[styles.box, packed && styles.boxPacked, { transform: [{ scale }] }]}>
          {packed && <Text style={styles.boxCheck}>✓</Text>}
        </Animated.View>
      </Pressable>
      <Pressable
        style={styles.itemTextWrap}
        onLongPress={onRemove}
        delayLongPress={450}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {({ pressed }) => (
          <Text numberOfLines={3} style={[styles.itemText, packed && styles.itemTextPacked, pressed && styles.itemTextHeld]}>{text}</Text>
        )}
      </Pressable>
    </View>
  );
}

type Toast = { message: string; undo: () => void } | null;

function UndoBar({ toast, onUndo }: { toast: NonNullable<Toast>; onUndo: () => void }) {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    rise.setValue(0);
    Animated.timing(rise, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [rise, toast]);
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  return (
    <Animated.View style={[styles.toast, { opacity: rise, transform: [{ translateY }] }]} accessibilityLiveRegion="polite">
      <Text style={styles.toastText} numberOfLines={1}>{toast.message}</Text>
      <Pressable onPress={onUndo} hitSlop={12} accessibilityRole="button">
        <Text style={styles.toastAction}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

const moveAnimation = () => LayoutAnimation.configureNext(
  LayoutAnimation.create(240, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
);

function PackingApp() {
  const [lists, setLists] = useState<PackingList[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveIssue, setSaveIssue] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogText, setDialogText] = useState('');
  const [itemText, setItemText] = useState('');
  const [popId, setPopId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (next: NonNullable<Toast>) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
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
    moveAnimation();
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

  const goHome = () => { setSelectedId(null); setItemText(''); setToast(null); };

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

  const toggle = (listId: string, itemId: string, value: boolean) => {
    moveAnimation();
    setPopId(value ? itemId : null);
    editList(listId, (list) => ({
      ...list, items: list.items.map((current) => current.id === itemId ? { ...current, packed: value } : current),
    }));
  };
  const remove = (listId: string, itemId: string) => {
    const list = lists.find((entry) => entry.id === listId);
    const index = list?.items.findIndex((current) => current.id === itemId) ?? -1;
    if (!list || index < 0) return;
    const removed = list.items[index];
    moveAnimation();
    editList(listId, (current) => ({ ...current, items: current.items.filter((entry) => entry.id !== itemId) }));
    showToast({
      message: `Removed ${removed.text}`,
      undo: () => {
        moveAnimation();
        editList(listId, (current) => {
          if (current.items.some((entry) => entry.id === removed.id)) return current;
          const items = [...current.items];
          items.splice(Math.min(index, items.length), 0, removed);
          return { ...current, items };
        });
      },
    });
  };

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
            <View style={styles.titleBlock}>
              <Text style={[styles.detailTitle, total > 0 && packed === total && styles.detailTitleStamped]} accessibilityRole="header">{selectedList.title}</Text>
              {total > 0 && packed === total && <PackedStamp />}
            </View>
            <Strap packed={packed} total={total} thick />
            <Text style={styles.detailStatus}>{statusLine(packed, total)}</Text>

            {pending.length > 0 && (
              <View style={styles.sheet}>
                {pending.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    text={item.text}
                    packed={false}
                    pop={false}
                    last={i === pending.length - 1}
                    onToggle={() => toggle(selectedList.id, item.id, true)}
                    onRemove={() => remove(selectedList.id, item.id)}
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
                      pop={item.id === popId}
                      last={i === finished.length - 1}
                      onToggle={() => toggle(selectedList.id, item.id, false)}
                      onRemove={() => remove(selectedList.id, item.id)}
                    />
                  ))}
                </View>
              </>
            )}
            {total > 0 && <Text style={styles.hint}>Tap a box to pack it. Hold an item to remove it.</Text>}
            {saveIssue && <Text style={styles.saveIssue}>Changes aren't saving on this device. Free up storage and reopen the app.</Text>}
          </ScrollView>

          {toast && (
            <UndoBar
              toast={toast}
              onUndo={() => { toast.undo(); setToast(null); }}
            />
          )}
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
  detailTitle: { fontFamily: F.sign, fontSize: 44, lineHeight: 48, color: C.ink, letterSpacing: -0.5, paddingRight: 8 },
  detailStatus: { fontFamily: F.text, fontSize: 15, color: C.slate, marginTop: 10, marginBottom: 22 },
  groupTitle: { fontFamily: F.signMedium, fontSize: 18, color: C.slate, marginBottom: 8 },

  itemRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54 },
  boxHit: { paddingVertical: 12, paddingRight: 14 },
  itemTextWrap: { flex: 1, paddingVertical: 14 },
  itemTextHeld: { opacity: 0.45 },
  box: { width: 28, height: 28, borderRadius: 4, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  boxPacked: { backgroundColor: C.strap, borderColor: C.strap },
  boxCheck: { color: C.ink, fontSize: 15, fontWeight: '800', marginTop: -1 },
  itemText: { flex: 1, fontFamily: F.text, fontSize: 17, lineHeight: 23, color: C.ink },
  itemTextPacked: { color: C.slate, textDecorationLine: 'line-through' },
  hint: { fontFamily: F.text, fontSize: 13, color: C.slate, marginTop: 4, marginBottom: 12 },
  titleBlock: { marginTop: 8, marginBottom: 16 },
  detailTitleStamped: { paddingRight: 132 },
  stamp: { position: 'absolute', right: 0, top: 4, borderWidth: 3, borderColor: C.ink, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: C.strap },
  stampText: { fontFamily: F.sign, fontSize: 24, letterSpacing: 2, color: C.ink },
  toast: { position: 'absolute', left: 20, right: 20, bottom: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.ink, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 14 },
  toastText: { flex: 1, fontFamily: F.text, fontSize: 15, color: C.sheet, marginRight: 12 },
  toastAction: { fontFamily: F.textMedium, fontSize: 15, color: C.strap },
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
