import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchVehicleLabelSuggestions } from '../api/catalog';

type Props = {
  /** Full vehicle line sent to the API (make/model + optional color/plate). */
  value: string;
  onChange: (value: string) => void;
};

function combineLine(main: string, extra: string): string {
  const a = main.trim();
  const b = extra.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} · ${b}`.slice(0, 255);
}

function splitStoredValue(value: string): { main: string; extra: string } {
  const parts = value.split(' · ');
  if (parts.length <= 1) {
    return { main: value.trim(), extra: '' };
  }
  return { main: parts[0]?.trim() ?? '', extra: parts.slice(1).join(' · ').trim() };
}

export function VehicleSearchCombobox({ value, onChange }: Props) {
  const initial = useMemo(() => splitStoredValue(value), []);
  const [mainLine, setMainLine] = useState(initial.main);
  const [extraLine, setExtraLine] = useState(initial.extra);
  const [query, setQuery] = useState(initial.main);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const searchGen = useRef(0);

  const pushChange = useCallback(
    (main: string, extra: string) => {
      setMainLine(main);
      setExtraLine(extra);
      onChange(combineLine(main, extra));
    },
    [onChange],
  );

  useEffect(() => {
    if (!open) return;
    const gen = ++searchGen.current;
    setLoading(true);
    const timer = setTimeout(() => {
      fetchVehicleLabelSuggestions(query)
        .then((labels) => {
          if (gen === searchGen.current) setSuggestions(labels);
        })
        .catch(() => {
          if (gen === searchGen.current) setSuggestions([]);
        })
        .finally(() => {
          if (gen === searchGen.current) setLoading(false);
        });
    }, 280);
    return () => clearTimeout(timer);
  }, [query, open]);

  const trimmedQuery = query.trim();
  const showCustom =
    trimmedQuery.length >= 2 &&
    !suggestions.some((s) => s.toLowerCase() === trimmedQuery.toLowerCase());

  const onPick = (label: string) => {
    setQuery(label);
    pushChange(label, extraLine);
    setOpen(false);
  };

  const onUseCustom = () => {
    pushChange(trimmedQuery, extraLine);
    setOpen(false);
  };

  return (
    <View>
      <Text style={styles.label}>Vehicle</Text>
      <TextInput
        style={styles.input}
        placeholder="Search make & model…"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        maxLength={120}
        autoCorrect={false}
        autoCapitalize="words"
      />

      {open && (loading || suggestions.length > 0 || showCustom) ? (
        <View style={styles.dropdown}>
          {loading ? (
            <ActivityIndicator style={styles.dropdownLoader} color="#0284c7" />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.list}>
              {showCustom ? (
                <Pressable style={styles.row} onPress={onUseCustom}>
                  <View style={styles.addIconWrap}>
                    <Text style={styles.addIconText}>+</Text>
                  </View>
                  <Text style={styles.addText}>Add “{trimmedQuery}”</Text>
                </Pressable>
              ) : null}
              {suggestions.map((item) => (
                <Pressable key={item} style={styles.row} onPress={() => onPick(item)}>
                  <Text style={styles.rowText}>{item}</Text>
                </Pressable>
              ))}
              {!showCustom && suggestions.length === 0 ? (
                <Text style={styles.empty}>Type to search or add your vehicle.</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      ) : null}

      {mainLine ? (
        <View style={styles.selectedPill}>
          <Text style={styles.selectedText} numberOfLines={2}>
            Selected: {mainLine}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              setQuery('');
              pushChange('', extraLine);
              setOpen(true);
            }}
          >
            <Text style={styles.changeLink}>Change</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={[styles.label, styles.labelSpaced]}>Color, plate, or notes (optional)</Text>
      <TextInput
        style={styles.inputSingle}
        placeholder="e.g. white · ABC 1234"
        value={extraLine}
        onChangeText={(text) => pushChange(mainLine, text)}
        maxLength={120}
      />

      <Pressable style={styles.doneBtn} onPress={() => setOpen(false)}>
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '600', marginBottom: 8, color: '#0f172a' },
  labelSpaced: { marginTop: 16 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  inputSingle: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
  },
  dropdown: {
    marginTop: 6,
    maxHeight: 220,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  list: { flexGrow: 0 },
  dropdownLoader: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  rowText: { fontSize: 15, color: '#0f172a', flex: 1 },
  addIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addIconText: { color: '#fff', fontWeight: '700', fontSize: 16, lineHeight: 18 },
  addText: { flex: 1, color: '#0284c7', fontWeight: '600', fontSize: 15 },
  empty: { padding: 14, color: '#64748b', textAlign: 'center' },
  selectedPill: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  selectedText: { flex: 1, color: '#0c4a6e', fontWeight: '600' },
  changeLink: { color: '#0284c7', fontWeight: '700', fontSize: 13 },
  doneBtn: { marginTop: 12, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  doneBtnText: { color: '#64748b', fontWeight: '600' },
});
