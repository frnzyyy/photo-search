import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Photo } from "../services/database";

interface Props {
  photo: Photo | null;
  photos: Photo[];
  onClose: () => void;
}

const { width, height } = Dimensions.get("window");

export default function PhotoViewer({ photo, photos, onClose }: Props) {
  const [sharing, setSharing] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<Photo | null>(photo);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    setCurrentPhoto(photo);
  }, [photo]);

  if (!currentPhoto) return null;

  async function handleShare() {
    if (!currentPhoto) return;

    try {
      setSharing(true);

      await Sharing.shareAsync(currentPhoto.uri, {
        mimeType: "image/jpeg",
        dialogTitle: "Share Photo",
      });
    } catch (e) {
      console.log("Share error:", e);
    } finally {
      setSharing(false);
    }
  }

  function getCurrentIndex() {
    if (!currentPhoto) return -1;
    return photos.findIndex((p) => p.uri === currentPhoto.uri);
  }

  function goToNextPhoto() {
    const currentIndex = getCurrentIndex();
    if (currentIndex < 0 || currentIndex >= photos.length - 1) return;

    setCurrentPhoto(photos[currentIndex + 1]);
  }

  function goToPreviousPhoto() {
    const currentIndex = getCurrentIndex();
    if (currentIndex <= 0) return;

    setCurrentPhoto(photos[currentIndex - 1]);
  }

  return (
    <Modal visible={true} transparent={false} animationType="fade">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.counterText}>
            {getCurrentIndex() + 1} / {photos.length}
          </Text>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.headerBtn, styles.shareBtn]}
            disabled={sharing}
          >
            <Text style={styles.shareBtnText}>
              {sharing ? "Sharing..." : "Share ↗"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Full screen photo */}
        <ScrollView
          contentContainerStyle={styles.imageContainer}
          maximumZoomScale={4}
          minimumZoomScale={1}
          onTouchStart={(event) => {
            setTouchStartX(event.nativeEvent.touches[0].pageX);
          }}
          onTouchEnd={(event) => {
            if (touchStartX === null) return;

            const touchEndX = event.nativeEvent.changedTouches[0].pageX;
            const diffX = touchStartX - touchEndX;

            if (diffX > 60) {
              goToNextPhoto();
            } else if (diffX < -60) {
              goToPreviousPhoto();
            }

            setTouchStartX(null);
          }}
        >
          <Image
            source={{ uri: currentPhoto.uri }}
            style={styles.image}
            resizeMode="contain"
          />
        </ScrollView>

        {/* Description */}
        <View style={styles.footer}>
          <Text style={styles.description} numberOfLines={3}>
            {currentPhoto.description || currentPhoto.filename}
          </Text>
          <Text style={styles.tags} numberOfLines={2}>
            {currentPhoto.tags
              ? currentPhoto.tags
                  .split(",")
                  .map((t) => `#${t.trim()}`)
                  .join(" ")
              : ""}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#000",
  },
  headerBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#444",
  },
  headerBtnText: { color: "#fff", fontSize: 14 },
  counterText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "500",
  },
  shareBtn: { backgroundColor: "#378ADD", borderColor: "#378ADD" },
  shareBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width, height: height - 200 },
  footer: {
    padding: 16,
    backgroundColor: "#000",
    paddingBottom: 40,
  },
  description: { color: "#fff", fontSize: 13, marginBottom: 6 },
  tags: { color: "#888", fontSize: 12 },
});
