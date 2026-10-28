import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { homeIndicatorBottomInset, statusBarTopInset } from '../utils/screenInsets';

export type HelpRequestMediaItem = {
  id: number;
  media_type: string;
  url: string;
};

type Props = {
  media?: HelpRequestMediaItem[] | null;
  /** Local file URIs while composing a request (no viewer id). */
  localUris?: string[];
  title?: string;
  compact?: boolean;
};

export function HelpRequestPhotoGallery({
  media,
  localUris,
  title = 'Attached photos',
  compact = false,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const photos = useMemo(() => {
    const fromApi =
      media
        ?.filter((m) => m.media_type === 'photo' && m.url)
        .map((m) => ({ key: String(m.id), uri: resolveMediaUrl(m.url) }))
        .filter((m) => m.uri.length > 0) ?? [];
    if (fromApi.length > 0) {
      return fromApi;
    }
    return (localUris ?? []).map((uri, i) => ({ key: `local-${i}`, uri }));
  }, [localUris, media]);

  if (photos.length === 0) {
    return null;
  }

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const thumbSize = compact ? 72 : 100;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>Tap a photo to view full size</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => openViewer(index)}
            style={[styles.thumbBtn, { width: thumbSize, height: thumbSize }]}
            accessibilityRole="button"
            accessibilityLabel={`View photo ${index + 1} of ${photos.length}`}
          >
            <Image source={{ uri: item.uri }} style={styles.thumbImage} resizeMode="cover" />
            <View style={styles.thumbBadge}>
              <Text style={styles.thumbBadgeText}>View</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={viewerOpen} animationType="fade" transparent onRequestClose={() => setViewerOpen(false)}>
        <View
          style={[
            styles.modalBackdrop,
            { paddingTop: statusBarTopInset(), paddingBottom: homeIndicatorBottomInset() },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Photo {viewerIndex + 1} / {photos.length}
            </Text>
            <Pressable
              onPress={() => setViewerOpen(false)}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close photo viewer"
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          <View style={[styles.modalPage, { height: windowHeight * 0.65 }]}>
            <Image
              source={{ uri: photos[viewerIndex]?.uri }}
              style={styles.fullImage}
              resizeMode="contain"
              accessibilityLabel="Help request photo"
            />
          </View>

          {photos.length > 1 ? (
            <View style={styles.modalNav}>
              <Pressable
                disabled={viewerIndex <= 0}
                onPress={() => setViewerIndex((i) => Math.max(0, i - 1))}
                style={[styles.navBtn, viewerIndex <= 0 && styles.navBtnDisabled]}
              >
                <Text style={styles.navBtnText}>Previous</Text>
              </Pressable>
              <Pressable
                disabled={viewerIndex >= photos.length - 1}
                onPress={() => setViewerIndex((i) => Math.min(photos.length - 1, i + 1))}
                style={[styles.navBtn, viewerIndex >= photos.length - 1 && styles.navBtnDisabled]}
              >
                <Text style={styles.navBtnText}>Next</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  title: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 },
  hint: { fontSize: 12, color: '#94a3b8', marginTop: 2, marginBottom: 8 },
  row: { gap: 10, paddingVertical: 2 },
  thumbBtn: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  thumbImage: { width: '100%', height: '100%' },
  thumbBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  thumbBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
  closeBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeBtnText: { color: '#fff', fontWeight: '700' },
  modalPage: { alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: '100%', height: '100%' },
  modalNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  navBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { color: '#fff', fontWeight: '700' },
});
