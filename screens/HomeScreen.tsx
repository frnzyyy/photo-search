import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  dismissIndexingNotification,
  requestNotificationPermission,
  showIndexingNotification,
} from "../services/indexingService";
import {
  getAllPhotos,
  getIndexedCount,
  initDatabase,
  isIndexed,
  Photo,
  savePhoto,
  searchPhotos,
} from "../services/database";
import { getImageDescription } from "../services/vlm";
import PhotoViewer from "../components/PhotoViewer";
import * as Haptics from "expo-haptics";

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Photo[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState("Ready!");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotoUris, setSelectedPhotoUris] = useState<Set<string>>(
    new Set(),
  );
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPhoto, setMenuPhoto] = useState<any | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [activeMenuOption, setActiveMenuOption] = useState<
    "gallery" | "share" | "view" | "select" | null
  >(null);
  const [activeTouchPhotoUri, setActiveTouchPhotoUri] = useState<string | null>(
    null,
  );
  const indexingRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuGestureActiveRef = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const photoScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initDatabase();
    setIndexedCount(getIndexedCount());
  }, []);

  async function startIndexing() {
    if (indexingRef.current) return;

    const { status: permStatus } = await MediaLibrary.requestPermissionsAsync();
    if (permStatus !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }

    await requestNotificationPermission();
    indexingRef.current = true;
    setIndexing(true);
    setStatus("Loading photos...");

    let after: string | undefined = undefined;
    let hasMore = true;
    let total = 0;
    let indexed = getIndexedCount();

    setIndexedCount(indexed);

    while (hasMore) {
      const batch = await MediaLibrary.getAssetsAsync({
        mediaType: "photo",
        first: 20,
        after,
      });

      total += batch.assets.length;
      setTotalCount(total);
      hasMore = batch.hasNextPage;
      after = batch.endCursor;

      const unindexed = batch.assets.filter((a) => !isIndexed(a.uri));

      for (const asset of unindexed) {
        try {
          setStatus(`Indexing ${indexed + 1} of ${total}...`);
          const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
          const localUri = assetInfo.localUri ?? assetInfo.uri;
          const { description, tags } = await getImageDescription(localUri);
          savePhoto(asset.uri, asset.filename, description, tags);
          indexed++;
          setIndexedCount(indexed);
          await showIndexingNotification(indexed, total);
        } catch (e) {
          console.log("Failed to index:", asset.filename, e);
          savePhoto(asset.uri, asset.filename, "", []);
          indexed++;
          setIndexedCount(indexed);
        }
      }
    }

    indexingRef.current = false;
    setIndexing(false);
    await dismissIndexingNotification();
    setStatus(`Done! ${indexed} photos indexed.`);
  }

  function doSearch() {
    if (!query.trim()) return;
    setStatus("Searching...");
    const found = searchPhotos(query);
    setResults(found);
    if (found.length === 0) setStatus(`No results for "${query}"`);
    else setStatus(`${found.length} result(s) for "${query}"`);
  }

  function showAllPhotos() {
    setStatus("Loading all indexed photos...");

    const allPhotos = getAllPhotos();

    setResults(allPhotos);
    setQuery("");

    if (allPhotos.length === 0) {
      setStatus("No indexed photos yet.");
    } else {
      setStatus(`Showing all ${allPhotos.length} indexed photo(s)`);
    }
  }

  function getHoveredMenuOption(
    x: number,
    y: number,
  ): "gallery" | "share" | "view" | "select" | null {
    const menuLeft = Math.max(20, menuPosition.x - 80);
    const menuTop = Math.max(100, menuPosition.y - 120);

    const buttons = [
      {
        option: "gallery" as const,
        left: menuLeft + 0,
        top: menuTop + 55,
      },
      {
        option: "share" as const,
        left: menuLeft + 62,
        top: menuTop + 18,
      },
      {
        option: "view" as const,
        left: menuLeft + 105,
        top: menuTop + 82,
      },
      {
        option: "select" as const,
        left: menuLeft + 45,
        top: menuTop + 120,
      },
    ];

    for (const button of buttons) {
      const centerX = button.left + 27;
      const centerY = button.top + 27;

      const distance = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2),
      );

      if (distance <= 34) {
        return button.option;
      }
    }

    return null;
  }

  function handlePhotoTouchStart(photo: any, event: any) {
    const touch = event.nativeEvent.touches?.[0];
    if (!touch) return;

    setActiveTouchPhotoUri(photo.uri);
    animatePhotoScale(0.96);

    touchStartRef.current = {
      x: touch.pageX,
      y: touch.pageY,
    };

    menuGestureActiveRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      menuGestureActiveRef.current = true;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setMenuPhoto(photo);
      setMenuPosition({
        x: touchStartRef.current.x,
        y: touchStartRef.current.y,
      });
      setActiveMenuOption(null);
      setMenuVisible(true);
      animatePhotoScale(1.04);
    }, 350);
  }

  function handlePhotoTouchMove(event: any) {
    const touch = event.nativeEvent.touches?.[0];
    if (!touch) return;

    const moveDistance = Math.sqrt(
      Math.pow(touch.pageX - touchStartRef.current.x, 2) +
        Math.pow(touch.pageY - touchStartRef.current.y, 2),
    );

    if (!menuGestureActiveRef.current && moveDistance > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }

    if (menuGestureActiveRef.current) {
      const hoveredOption = getHoveredMenuOption(touch.pageX, touch.pageY);
      setActiveMenuOption(hoveredOption);
    }
  }

  async function handlePhotoTouchEnd(photo: any, event: any) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    animatePhotoScale(1);

    setTimeout(() => {
      setActiveTouchPhotoUri(null);
    }, 120);

    if (!menuGestureActiveRef.current) {
      return;
    }

    const touch = event.nativeEvent.changedTouches?.[0];
    const finalOption = touch
      ? getHoveredMenuOption(touch.pageX, touch.pageY)
      : activeMenuOption;

    menuGestureActiveRef.current = false;
    setMenuVisible(false);
    setActiveMenuOption(null);

    if (finalOption === "share") {
      try {
        await Sharing.shareAsync(photo.uri, {
          mimeType: "image/jpeg",
          dialogTitle: "Share Photo",
        });
      } catch (error) {
        console.log("Share error:", error);
      }
      return;
    }

    if (finalOption === "view") {
      setSelectedPhoto(photo);
      return;
    }

    if (finalOption === "gallery") {
      await openPhotoInGallery(photo);
      return;
    }

    if (finalOption === "select") {
      setSelectionMode(true);
      setSelectedPhotoUris(new Set([photo.uri]));
      return;
    }
  }

  function animatePhotoScale(toValue: number) {
    Animated.spring(photoScaleAnim, {
      toValue,
      useNativeDriver: true,
      tension: 180,
      friction: 12,
    }).start();
  }

  async function openPhotoInGallery(photo: any) {
    if (!photo?.uri) return;

    try {
      const safeFilename =
        photo.filename?.replace(/[^a-zA-Z0-9._-]/g, "_") ||
        `photo-${Date.now()}.jpg`;

      const cachedUri = `${FileSystem.cacheDirectory}${safeFilename}`;

      await FileSystem.copyAsync({
        from: photo.uri,
        to: cachedUri,
      });

      const contentUri = await FileSystem.getContentUriAsync(cachedUri);

      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: "image/*",
        flags: 1,
      });
    } catch (error) {
      console.log("Open gallery error:", error);
      alert("Unable to open this photo in gallery.");
    }
  }

  function togglePhotoSelection(photo: Photo) {
    setSelectedPhotoUris((previous) => {
      const next = new Set(previous);

      if (next.has(photo.uri)) {
        next.delete(photo.uri);
      } else {
        next.add(photo.uri);
      }

      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedPhotoUris(new Set());
  }

  async function handleBulkShare() {
    const selectedPhotos = results.filter((photo) =>
      selectedPhotoUris.has(photo.uri),
    );

    if (selectedPhotos.length === 0) {
      alert("No photos selected.");
      return;
    }

    if (selectedPhotos.length === 1) {
      try {
        await Sharing.shareAsync(selectedPhotos[0].uri, {
          mimeType: "image/jpeg",
          dialogTitle: "Share Photo",
        });

        exitSelectionMode();
      } catch (error) {
        console.log("Single share error:", error);
        alert("Unable to share photo.");
      }

      return;
    }

    alert(
      "Bulk share needs a native Android share module. For now, select only one photo to share.",
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📷 Photo Search</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search: horse, receipt, sunset..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={doSearch}
        />
        <TouchableOpacity style={styles.button} onPress={doSearch}>
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={showAllPhotos}>
          <Text style={styles.secondaryButtonText}>Show All</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.status}>{status}</Text>

      {!indexing && (
        <TouchableOpacity style={styles.indexButton} onPress={startIndexing}>
          <Text style={styles.indexButtonText}>
            {indexedCount > 0
              ? `Resume Indexing (${indexedCount} done)`
              : "Start Indexing Gallery"}
          </Text>
        </TouchableOpacity>
      )}

      {indexing && (
        <View style={styles.indexingRow}>
          <ActivityIndicator size="small" color="#378ADD" />
          <Text style={styles.indexingText}>
            {indexedCount} / {totalCount} indexed
          </Text>
        </View>
      )}

      {selectionMode && (
        <View style={styles.selectionToolbar}>
          <Text style={styles.selectionText}>
            {selectedPhotoUris.size} selected
          </Text>

          <TouchableOpacity
            style={styles.selectionButton}
            onPress={handleBulkShare}
          >
            <Text style={styles.selectionButtonText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.selectionCancelButton}
            onPress={exitSelectionMode}
          >
            <Text style={styles.selectionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        numColumns={3}
        scrollEnabled={!menuVisible}
        renderItem={({ item }) => (
          <Pressable
            style={styles.photoCard}
            onPress={() => {
              if (menuVisible) return;

              if (selectionMode) {
                togglePhotoSelection(item);
                return;
              }

              setSelectedPhoto(item);
            }}
            onTouchStart={(event) => handlePhotoTouchStart(item, event)}
            onTouchMove={handlePhotoTouchMove}
            onTouchEnd={(event) => handlePhotoTouchEnd(item, event)}
          >
            <Animated.View
              style={[
                activeTouchPhotoUri === item.uri && {
                  transform: [{ scale: photoScaleAnim }],
                  zIndex: 1000,
                },
              ]}
            >
              <Image source={{ uri: item.uri }} style={styles.photo} />
              {selectedPhotoUris.has(item.uri) && (
                <View style={styles.selectedOverlay}>
                  <Feather name="check" size={26} color="#fff" />
                </View>
              )}
            </Animated.View>
            <Text style={styles.photoDesc} numberOfLines={2}>
              {item.description}
            </Text>
          </Pressable>
        )}
      />
      <PhotoViewer
        photo={selectedPhoto}
        photos={results}
        onClose={() => setSelectedPhoto(null)}
      />

      {menuVisible && (
        <View style={styles.floatingMenuOverlay}>
          <View
            style={[
              styles.floatingMenu,
              {
                left: Math.max(20, menuPosition.x - 80),
                top: Math.max(100, menuPosition.y - 120),
              },
            ]}
          >
            <Pressable
              style={[
                styles.floatingButton,
                { left: 0, top: 55 },
                activeMenuOption === "gallery" && styles.floatingButtonActive,
              ]}
              onPress={() => {
                if (!menuPhoto) return;

                setMenuVisible(false);
                openPhotoInGallery(menuPhoto);
              }}
            >
              <MaterialCommunityIcons
                name="image-outline"
                size={26}
                color="#fff"
              />
            </Pressable>

            <Pressable
              style={[
                styles.floatingButton,
                { left: 62, top: 18 },
                activeMenuOption === "share" && styles.floatingButtonActive,
              ]}
              onPress={async () => {
                if (!menuPhoto) return;

                try {
                  setMenuVisible(false);
                  await Sharing.shareAsync(menuPhoto.uri, {
                    mimeType: "image/jpeg",
                    dialogTitle: "Share Photo",
                  });
                } catch (error) {
                  console.log("Share error:", error);
                }
              }}
            >
              <Feather name="share-2" size={26} color="#fff" />
            </Pressable>

            <Pressable
              style={[
                styles.floatingButton,
                { left: 105, top: 82 },
                activeMenuOption === "view" && styles.floatingButtonActive,
              ]}
              onPress={() => {
                if (!menuPhoto) return;

                setMenuVisible(false);
                setSelectedPhoto(menuPhoto);
              }}
            >
              <Feather name="zoom-in" size={26} color="#fff" />
            </Pressable>

            <Pressable
              style={[
                styles.floatingButton,
                { left: 45, top: 120 },
                activeMenuOption === "select" && styles.floatingButtonActive,
              ]}
              onPress={() => {
                if (!menuPhoto) return;

                setMenuVisible(false);
                setSelectionMode(true);
                setSelectedPhotoUris(new Set([menuPhoto.uri]));
              }}
            >
              <Feather name="check-square" size={26} color="#fff" />
            </Pressable>

            <View style={styles.floatingLabel}>
              <Text style={styles.floatingLabelText}>
                {activeMenuOption === "gallery"
                  ? "Open in Gallery"
                  : activeMenuOption === "share"
                    ? "Share"
                    : activeMenuOption === "view"
                      ? "View Fullscreen"
                      : activeMenuOption === "select"
                        ? "Select"
                        : "Photo options"}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 50, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "500", marginBottom: 16 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  button: {
    backgroundColor: "#378ADD",
    borderRadius: 8,
    padding: 10,
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "500" },
  secondaryButton: {
    backgroundColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  status: { fontSize: 13, color: "#888", marginBottom: 12 },
  indexButton: {
    borderWidth: 0.5,
    borderColor: "#378ADD",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  indexButtonText: { color: "#378ADD", fontWeight: "500" },
  indexingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  indexingText: { fontSize: 13, color: "#888" },
  selectionToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  selectionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  selectionButton: {
    backgroundColor: "#378ADD",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectionButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  selectionCancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectionCancelText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
  },
  photoCard: { flex: 1 / 3, padding: 2 },
  photo: { width: "100%", aspectRatio: 1, borderRadius: 6 },
  photoDesc: { fontSize: 9, color: "#888", marginTop: 2 },
  selectedOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(55, 138, 221, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  floatingMenuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 999,
  },
  floatingMenu: {
    position: "absolute",
    width: 180,
    height: 230,
  },
  floatingButton: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(55,55,48,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  floatingButtonActive: {
    transform: [{ scale: 1.18 }],
    backgroundColor: "rgba(90,90,80,1)",
  },
  floatingIcon: {
    fontSize: 30,
    color: "#fff",
  },
  floatingLabel: {
    position: "absolute",
    left: 10,
    top: 185,
    backgroundColor: "rgba(30,30,30,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  floatingLabelText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
