import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PhotoViewer from "../../components/PhotoViewer";
import {
  Collection,
  Photo,
  getCollections,
  getPhotosInCollection,
} from "../../services/database";

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);
  const [collectionPhotos, setCollectionPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useFocusEffect(
    useCallback(() => {
      setCollections(getCollections());
    }, []),
  );

  function openCollection(collection: Collection) {
    setSelectedCollection(collection);
    setCollectionPhotos(getPhotosInCollection(collection.id));
  }

  function renderCollectionPreview(photos: Photo[]) {
    const previewPhotos = photos.slice(0, 3);

    if (previewPhotos.length === 0) {
      return (
        <View style={[styles.collectionPreview, styles.emptyPreview]}>
          <Text style={styles.emptyPreviewText}>No photos</Text>
        </View>
      );
    }

    return (
      <View style={styles.collectionPreview}>
        <Image
          source={{ uri: previewPhotos[0].uri }}
          style={styles.previewImagePrimary}
        />

        {previewPhotos.length > 1 && (
          <View style={styles.previewImageStack}>
            {previewPhotos.slice(1).map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: photo.uri }}
                style={styles.previewImageSmall}
              />
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderCollectionCard({ item }: { item: Collection }) {
    const photos = getPhotosInCollection(item.id);
    const photoLabel = photos.length === 1 ? "1 photo" : `${photos.length} photos`;

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        style={styles.collectionCard}
        onPress={() => openCollection(item)}
      >
        {renderCollectionPreview(photos)}

        <View style={styles.collectionCardBody}>
          <Text style={styles.collectionName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.collectionMeta}>
            {photoLabel} - Created {item.created_at}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (selectedCollection) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.detailHeader}>
          <TouchableOpacity
            activeOpacity={0.72}
            style={styles.backButton}
            onPress={() => {
              setSelectedCollection(null);
              setCollectionPhotos([]);
              setSelectedPhoto(null);
            }}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{selectedCollection.name}</Text>
        <Text style={styles.subtitle}>
          {collectionPhotos.length === 1
            ? "1 saved photo"
            : `${collectionPhotos.length} saved photos`}
        </Text>

        {collectionPhotos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyBody}>
              Saved photos for this collection will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={collectionPhotos}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            columnWrapperStyle={styles.photoGridRow}
            contentContainerStyle={styles.photoGridContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.photoCard}
                onPress={() => setSelectedPhoto(item)}
              >
                <Image source={{ uri: item.uri }} style={styles.photo} />
              </TouchableOpacity>
            )}
          />
        )}

        <PhotoViewer
          photo={selectedPhoto}
          photos={collectionPhotos}
          onClose={() => setSelectedPhoto(null)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Collections</Text>
        <Text style={styles.subtitle}>Organized photo boards</Text>
      </View>

      {collections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No collections yet</Text>
          <Text style={styles.emptyBody}>
            Saved photo collections will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.collectionList}
          showsVerticalScrollIndicator={false}
          renderItem={renderCollectionCard}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  headerBlock: {
    marginBottom: 16,
  },
  detailHeader: {
    minHeight: 48,
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    color: "#211922",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 18,
    color: "#62625B",
    marginBottom: 16,
  },
  collectionList: {
    paddingBottom: 24,
  },
  collectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E5E0",
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  collectionPreview: {
    height: 148,
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#EFEFEF",
    overflow: "hidden",
  },
  emptyPreview: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyPreviewText: {
    color: "#62625B",
    fontSize: 12,
    fontWeight: "700",
  },
  previewImagePrimary: {
    flex: 1,
    height: "100%",
    backgroundColor: "#EFEFEF",
  },
  previewImageStack: {
    width: 92,
    gap: 4,
  },
  previewImageSmall: {
    flex: 1,
    width: "100%",
    backgroundColor: "#EFEFEF",
  },
  collectionCardBody: {
    padding: 12,
  },
  collectionName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: "#211922",
  },
  collectionMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#62625B",
  },
  backButton: {
    minHeight: 48,
    alignSelf: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#E5E5E0",
  },
  backButtonText: {
    color: "#211922",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  photoGridContent: {
    paddingBottom: 24,
  },
  photoGridRow: {
    gap: 10,
  },
  photoCard: {
    flex: 1 / 2,
    aspectRatio: 0.82,
    marginBottom: 10,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EFEFEF",
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: "#EFEFEF",
  },
  emptyState: {
    backgroundColor: "#F6F6F3",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E5E0",
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
});
