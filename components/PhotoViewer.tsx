import * as Sharing from "expo-sharing";
import { useState } from "react";
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
  onClose: () => void;
}

const { width, height } = Dimensions.get("window");

export default function PhotoViewer({ photo, onClose }: Props) {
  const [sharing, setSharing] = useState(false);

  if (!photo) return null;

  async function handleShare() {
    try {
      setSharing(true);
      await Sharing.shareAsync(photo!.uri, {
        mimeType: "image/jpeg",
        dialogTitle: "Share Photo",
      });
    } catch (e) {
      console.log("Share error:", e);
    } finally {
      setSharing(false);
    }
  }
  return (
    <Modal visible={true} transparent={false} animationType="fade">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>✕ Close</Text>
          </TouchableOpacity>
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
        >
          <Image
            source={{ uri: photo.uri }}
            style={styles.image}
            resizeMode="contain"
          />
        </ScrollView>

        {/* Description */}
        <View style={styles.footer}>
          <Text style={styles.description} numberOfLines={3}>
            {photo.description || photo.filename}
          </Text>
          <Text style={styles.tags} numberOfLines={2}>
            {photo.tags
              ? photo.tags
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
