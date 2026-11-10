import { StyleSheet } from 'react-native';

/** Shared layout for owner directory browse (mechanics + shops). */
export const directoryBrowseStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e2e8f0' },
  mapSection: { height: 300, position: 'relative' },
  sheetArea: { zIndex: 2 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  count: { fontSize: 15, color: '#0284c7', fontWeight: '600', marginTop: 4, marginBottom: 8 },
  recommend: { color: '#0284c7', fontWeight: '600', marginTop: 12 },
  list: { flex: 1, backgroundColor: '#f8fafc' },
  listContent: { padding: 16, paddingBottom: 32 },
});
