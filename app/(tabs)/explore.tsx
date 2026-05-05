import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Collection,
  Photo,
  getCollections,
  getPhotosInCollection,
} from "../../services/database";
import PhotoViewer from "../../components/PhotoViewer";

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

  if (selectedCollection) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setSelectedCollection(null);
            setCollectionPhotos([]);
          }}
        >
          <Text style={styles.backButtonText}>← Back to Collections</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{selectedCollection.name}</Text>

        {collectionPhotos.length === 0 ? (
          <Text style={styles.subtitle}>No photos in this collection yet.</Text>
        ) : (
          <FlatList
            data={collectionPhotos}
            keyExtractor={(item) => item.id.toString()}
            numColumns={3}
            renderItem={({ item }) => (
              <TouchableOpacity
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Collections</Text>
      {collections.length === 0 ? (
        <Text style={styles.subtitle}>No collections yet.</Text>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.collectionCard}
              onPress={() => openCollection(item)}
            >
              <Text style={styles.collectionName}>{item.name}</Text>
              <Text style={styles.collectionDate}>
                Created {item.created_at}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#777",
  },
  collectionCard: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  collectionName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  collectionDate: {
    marginTop: 4,
    fontSize: 12,
    color: "#777",
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: "#378ADD",
    fontSize: 14,
    fontWeight: "700",
  },
  photoCard: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 3,
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#eee",
  },
});
