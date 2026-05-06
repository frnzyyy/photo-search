import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as KeepAwake from "expo-keep-awake";
import * as IntentLauncher from "expo-intent-launcher";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  dismissIndexingNotification,
  requestNotificationPermission,
  showIndexingNotification,
} from "../services/indexingService";
import {
  addPhotoToCollection,
  Collection,
  createCollection,
  getAllPhotos,
  getCollections,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FLOATING_BUTTON_SIZE = 54;
const FLOATING_MENU_WIDTH = 240;
const FLOATING_MENU_HEIGHT = 220;
const KEEP_AWAKE_TAG = "photo-search-indexing";

const FLOATING_MENU_BUTTONS = [
  {
    option: "gallery" as const,
    left: 8,
    top: 104,
  },
  {
    option: "share" as const,
    left: 40,
    top: 58,
  },
  {
    option: "view" as const,
    left: 93,
    top: 34,
  },
  {
    option: "select" as const,
    left: 146,
    top: 58,
  },
  {
    option: "collection" as const,
    left: 178,
    top: 104,
  },
];

async function safeActivateKeepAwake() {
  try {
    const available = await KeepAwake.isAvailableAsync();

    if (available) {
      await KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    }
  } catch (error) {
    console.warn("Keep awake could not be activated:", error);
  }
}

async function safeDeactivateKeepAwake() {
  try {
    await KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG);
  } catch (error) {
    console.warn("Keep awake could not be deactivated:", error);
  }
}

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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionTargetPhoto, setCollectionTargetPhoto] =
    useState<Photo | null>(null);

  function loadCollections() {
    const savedCollections = getCollections();
    setCollections(savedCollections);
  }

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPhoto, setMenuPhoto] = useState<any | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [activeMenuOption, setActiveMenuOption] = useState<
    "gallery" | "share" | "view" | "select" | "collection" | null
  >(null);
  const [activeTouchPhotoUri, setActiveTouchPhotoUri] = useState<string | null>(
    null,
  );
  const indexingRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuGestureActiveRef = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const holdPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const photoScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initDatabase();
    loadCollections();

    const allPhotos = getAllPhotos();
    setResults(allPhotos);

    if (allPhotos.length > 0) {
      setStatus(`Showing all ${allPhotos.length} indexed photo(s)`);
    }

    setIndexedCount(getIndexedCount());

    return () => {
      void safeDeactivateKeepAwake();
    };
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
    await safeActivateKeepAwake();

    let after: string | undefined = undefined;
    let hasMore = true;
    let total = 0;
    let indexed = getIndexedCount();

    setIndexedCount(indexed);

    try {
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
    } finally {
      indexingRef.current = false;
      setIndexing(false);
      await safeDeactivateKeepAwake();
      await dismissIndexingNotification();
    }

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

  function clearSearch() {
    const allPhotos = getAllPhotos();

    setQuery("");
    setResults(allPhotos);

    if (allPhotos.length === 0) {
      setStatus("No indexed photos yet.");
    } else {
      setStatus(`Showing all ${allPhotos.length} indexed photo(s)`);
    }
  }

  function getHoveredMenuOption(
    x: number,
    y: number,
  ): "gallery" | "share" | "view" | "select" | "collection" | null {
    const menuLeft = Math.min(
      Math.max(12, menuPosition.x - FLOATING_MENU_WIDTH / 2),
      SCREEN_WIDTH - FLOATING_MENU_WIDTH - 12,
    );

    const menuTop = Math.max(80, menuPosition.y - FLOATING_MENU_HEIGHT + 20);

    const buttons = FLOATING_MENU_BUTTONS.map((button) => ({
      option: button.option,
      left: menuLeft + button.left,
      top: menuTop + button.top,
    }));

    for (const button of buttons) {
      const centerX = button.left + 28;
      const centerY = button.top + 28;

      const distance = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2),
      );

      if (distance <= 36) {
        return button.option;
      }
    }

    return null;
  }

  function handlePhotoTouchStart(photo: any, event: any) {
    const touch = event.nativeEvent.touches?.[0];
    if (!touch) return;

    touchStartRef.current = {
      x: touch.pageX,
      y: touch.pageY,
    };

    if (holdPreviewTimerRef.current) {
      clearTimeout(holdPreviewTimerRef.current);
    }

    holdPreviewTimerRef.current = setTimeout(() => {
      setActiveTouchPhotoUri(photo.uri);
      animatePhotoScale(0.96);
    }, 180);

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
    }, 650);
  }

  function handlePhotoTouchMove(event: any) {
    const touch = event.nativeEvent.touches?.[0];
    if (!touch) return;

    const moveDistance = Math.sqrt(
      Math.pow(touch.pageX - touchStartRef.current.x, 2) +
        Math.pow(touch.pageY - touchStartRef.current.y, 2),
    );

    if (!menuGestureActiveRef.current && moveDistance > 4) {
      if (holdPreviewTimerRef.current) {
        clearTimeout(holdPreviewTimerRef.current);
        holdPreviewTimerRef.current = null;
      }

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      setActiveTouchPhotoUri(null);
      animatePhotoScale(1);

      return;
    }

    if (menuGestureActiveRef.current) {
      const hoveredOption = getHoveredMenuOption(touch.pageX, touch.pageY);
      setActiveMenuOption(hoveredOption);
    }
  }

  function cancelPendingLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!menuGestureActiveRef.current) {
      setActiveTouchPhotoUri(null);
      animatePhotoScale(1);
    }
  }

  async function handlePhotoTouchEnd(photo: any, event: any) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (holdPreviewTimerRef.current) {
      clearTimeout(holdPreviewTimerRef.current);
      holdPreviewTimerRef.current = null;
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

    if (finalOption === "collection") {
      openCollectionModal(photo);
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

  function openCollectionModal(photo: Photo) {
    setCollectionTargetPhoto(photo);
    loadCollections();
    setCollectionModalVisible(true);
  }

  function handleCreateCollectionAndSave() {
    if (!collectionTargetPhoto) return;

    try {
      createCollection(newCollectionName);
      loadCollections();

      const updatedCollections = getCollections();
      const createdCollection = updatedCollections.find(
        (collection) =>
          collection.name.toLowerCase() ===
          newCollectionName.trim().toLowerCase(),
      );

      if (!createdCollection) {
        alert("Collection was created, but could not be found.");
        return;
      }

      addPhotoToCollection(collectionTargetPhoto.id, createdCollection.id);

      setNewCollectionName("");
      setCollectionModalVisible(false);
      setCollectionTargetPhoto(null);

      alert(`Saved to "${createdCollection.name}"`);
    } catch (error) {
      console.log("Create collection error:", error);
      alert("Unable to create collection.");
    }
  }

  function handleSaveToExistingCollection(collection: Collection) {
    if (!collectionTargetPhoto) return;

    try {
      addPhotoToCollection(collectionTargetPhoto.id, collection.id);

      setCollectionModalVisible(false);
      setCollectionTargetPhoto(null);
      setNewCollectionName("");

      alert(`Saved to "${collection.name}"`);
    } catch (error) {
      console.log("Save to collection error:", error);
      alert("Unable to save to collection.");
    }
  }

  function closeFloatingMenu() {
    if (holdPreviewTimerRef.current) {
      clearTimeout(holdPreviewTimerRef.current);
      holdPreviewTimerRef.current = null;
    }

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    menuGestureActiveRef.current = false;

    setMenuVisible(false);
    setActiveMenuOption(null);
    setMenuPhoto(null);
    setActiveTouchPhotoUri(null);
    animatePhotoScale(1);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBlock}>
        <View>
          <Text style={styles.title}>Photo Search</Text>
          <Text style={styles.subtitle}>AI-powered gallery search</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Search: horse, receipt, sunset..."
            placeholderTextColor="#62625B"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={doSearch}
          />

          {query.length > 0 && (
            <TouchableOpacity
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              style={styles.clearSearchButton}
              onPress={clearSearch}
            >
              <Feather name="x" size={20} color="#211922" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.button} onPress={doSearch}>
          <Feather name="search" size={22} color="#FFFFFF" />
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
        key="home-photo-grid-2"
        data={results}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        scrollEnabled={!menuVisible}
        onScrollBeginDrag={closeFloatingMenu}
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={7}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
        contentContainerStyle={styles.photoGridContent}
        columnWrapperStyle={styles.photoGridRow}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyBody}>
              Search or show all indexed photos to start browsing.
            </Text>
          </View>
        }
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
                styles.photoImageWrapper,
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
        <Pressable style={styles.floatingMenuOverlay} onPress={closeFloatingMenu}>
          <View
            style={[
              styles.floatingMenu,
              {
                left: Math.min(
                  Math.max(12, menuPosition.x - FLOATING_MENU_WIDTH / 2),
                  SCREEN_WIDTH - FLOATING_MENU_WIDTH - 12,
                ),
                top: Math.max(
                  80,
                  menuPosition.y - FLOATING_MENU_HEIGHT + 20,
                ),
              },
            ]}
          >
            <Pressable
              style={[
                styles.floatingButton,
                {
                  left: FLOATING_MENU_BUTTONS[0].left,
                  top: FLOATING_MENU_BUTTONS[0].top,
                },
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
                {
                  left: FLOATING_MENU_BUTTONS[1].left,
                  top: FLOATING_MENU_BUTTONS[1].top,
                },
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
                {
                  left: FLOATING_MENU_BUTTONS[2].left,
                  top: FLOATING_MENU_BUTTONS[2].top,
                },
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
                {
                  left: FLOATING_MENU_BUTTONS[3].left,
                  top: FLOATING_MENU_BUTTONS[3].top,
                },
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

            <Pressable
              style={[
                styles.floatingButton,
                {
                  left: FLOATING_MENU_BUTTONS[4].left,
                  top: FLOATING_MENU_BUTTONS[4].top,
                },
                activeMenuOption === "collection" &&
                  styles.floatingButtonActive,
              ]}
              onPress={() => {
                if (!menuPhoto) return;

                setMenuVisible(false);
                openCollectionModal(menuPhoto);
              }}
            >
              <Feather name="folder-plus" size={26} color="#fff" />
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
                        : activeMenuOption === "collection"
                          ? "Save to Collection"
                          : "Photo options"}
              </Text>
            </View>
          </View>
        </Pressable>
      )}

      <Modal
        visible={collectionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCollectionModalVisible(false)}
      >
        <View style={styles.collectionModalOverlay}>
          <View style={styles.collectionModalBox}>
            <Text style={styles.collectionModalTitle}>Save to Collection</Text>

            <TextInput
              style={styles.collectionInput}
              placeholder="New collection name"
              placeholderTextColor="#62625B"
              value={newCollectionName}
              onChangeText={setNewCollectionName}
            />

            <TouchableOpacity
              style={styles.collectionCreateButton}
              onPress={handleCreateCollectionAndSave}
            >
              <Text style={styles.collectionCreateText}>Create Collection</Text>
            </TouchableOpacity>

            <Text style={styles.collectionSectionTitle}>
              Existing Collections
            </Text>

            {collections.length === 0 ? (
              <Text style={styles.emptyCollectionText}>No collections yet.</Text>
            ) : (
              collections.map((collection) => (
                <TouchableOpacity
                  key={collection.id}
                  style={styles.collectionItem}
                  onPress={() => handleSaveToExistingCollection(collection)}
                >
                  <Text style={styles.collectionItemText}>
                    {collection.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity
              style={styles.collectionCancelButton}
              onPress={() => setCollectionModalVisible(false)}
            >
              <Text style={styles.collectionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    backgroundColor: "#FFFFFF",
  },
  headerBlock: {
    marginBottom: 18,
    paddingTop: 4,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    color: "#211922",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: "#62625B",
    fontWeight: "500",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  searchInputWrap: {
    flex: 1,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 999,
    backgroundColor: "#EFEFEF",
  },
  input: {
    flex: 1,
    height: 52,
    paddingLeft: 16,
    paddingRight: 8,
    backgroundColor: "transparent",
    color: "#000000",
    fontSize: 16,
    lineHeight: 22,
  },
  clearSearchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    width: 52,
    height: 52,
    backgroundColor: "#E60023",
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  secondaryButton: {
    minWidth: 86,
    height: 48,
    backgroundColor: "#E5E5E0",
    paddingHorizontal: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#211922",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  status: {
    alignSelf: "flex-start",
    backgroundColor: "#F6F6F3",
    color: "#62625B",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  indexButton: {
    minHeight: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E60023",
  },
  indexButtonText: {
    color: "#E60023",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  indexingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    backgroundColor: "#F6F6F3",
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  indexingText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#62625B",
    fontWeight: "600",
  },
  selectionToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#211922",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 12,
    minHeight: 56,
  },
  selectionText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  selectionButton: {
    backgroundColor: "#E60023",
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  selectionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  selectionCancelButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  selectionCancelText: {
    color: "#E5E5E0",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  photoGridContent: {
    paddingBottom: 28,
  },
  photoGridRow: {
    gap: 10,
  },
  photoCard: {
    flex: 1,
    marginBottom: 12,
  },
  photoImageWrapper: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EFEFEF",
    borderWidth: 1,
    borderColor: "#E5E5E0",
  },
  photo: {
    width: "100%",
    aspectRatio: 0.82,
    borderRadius: 12,
    backgroundColor: "#EFEFEF",
  },
  photoDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: "#62625B",
    marginTop: 6,
    paddingHorizontal: 2,
  },
  selectedOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E60023",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  emptyState: {
    backgroundColor: "#F6F6F3",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E5E0",
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    color: "#211922",
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 18,
    color: "#62625B",
  },
  floatingMenuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.52)",
    zIndex: 999,
  },
  floatingMenu: {
    position: "absolute",
    width: 190,
    height: 285,
  },
  floatingButton: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(33,25,34,0.96)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  floatingButtonActive: {
    transform: [{ scale: 1.18 }],
    backgroundColor: "#E60023",
  },
  floatingLabel: {
    position: "absolute",
    left: 55,
    top: 165,
    backgroundColor: "rgba(33,25,34,0.94)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  floatingLabelText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  collectionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  collectionModalBox: {
    width: "100%",
    maxHeight: "86%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  collectionModalTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    color: "#211922",
    marginBottom: 16,
  },
  collectionInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "#919190",
    borderRadius: 16,
    paddingHorizontal: 15,
    color: "#000000",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  collectionCreateButton: {
    minHeight: 48,
    backgroundColor: "#E60023",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  collectionCreateText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },
  collectionSectionTitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: "#211922",
    marginBottom: 8,
  },
  emptyCollectionText: {
    color: "#62625B",
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 12,
  },
  collectionItem: {
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E0",
  },
  collectionItemText: {
    fontSize: 14,
    lineHeight: 18,
    color: "#211922",
    fontWeight: "700",
  },
  collectionCancelButton: {
    marginTop: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#E5E5E0",
  },
  collectionCancelText: {
    color: "#211922",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
});
