import { getBackendUrl, normalizeBackendUrl } from "./database";

export async function testBackendConnection(url: string): Promise<string> {
  const backendUrl = normalizeBackendUrl(url);

  if (!backendUrl) {
    throw new Error("Backend URL is required");
  }

  const response = await fetch(`${backendUrl}/`);
  const data = await response.json();

  if (!response.ok || data?.status !== "running") {
    throw new Error("Backend did not return status: running");
  }

  return backendUrl;
}

export async function getImageDescription(
  photoUri: string,
): Promise<{ description: string; tags: string[] }> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    throw new Error("Backend URL is not configured");
  }

  const formData = new FormData();
  formData.append("file", {
    uri: photoUri,
    type: "image/jpeg",
    name: "photo.jpg",
  } as any);

  const response = await fetch(`${backendUrl}/index`, {
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
