const BACKEND_URL = "http://192.168.100.56:8000";

export async function getImageDescription(
  photoUri: string,
): Promise<{ description: string; tags: string[] }> {
  const formData = new FormData();
  formData.append("file", {
    uri: photoUri,
    type: "image/jpeg",
    name: "photo.jpg",
  } as any);

  const response = await fetch(`${BACKEND_URL}/index`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return {
    description: data.description || "",
    tags: data.tags || [],
  };
}
