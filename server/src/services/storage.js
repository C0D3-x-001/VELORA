import { supabaseAdmin, isConfigured } from "../config/supabase.js";

export async function uploadFile(bucket, path, buffer, contentType) {
  if (!isConfigured) return { path: `mock://${path}` };

  const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) throw error;
  return data;
}

export async function getSignedUrl(bucket, path, expiresIn = 3600) {
  if (!isConfigured) return `https://mock.url/${path}`;

  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function getPublicUrl(bucket, path) {
  if (!isConfigured) return `https://mock.url/${path}`;

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function refreshSignedUrl(bucket, signedUrl, expiresIn = 86400 * 7) {
  if (!isConfigured || !signedUrl) return signedUrl;
  try {
    const url = new URL(signedUrl);
    const expires = parseInt(url.searchParams.get("expires") || "0", 10);
    if (!expires || Date.now() / 1000 < expires - 3600) return signedUrl;
    const token = url.searchParams.get("token");
    if (!token) return signedUrl;
    const storagePath = url.pathname.split("/storage/v1/object/sign/").pop()?.split("?")[0];
    if (!storagePath) return signedUrl;
    return await getSignedUrl(bucket, decodeURIComponent(storagePath), expiresIn);
  } catch {
    return signedUrl;
  }
}

export async function deleteFile(bucket, path) {
  if (!isConfigured) return { success: true };
  return supabaseAdmin.storage.from(bucket).remove([path]);
}

async function walkAllPaths(prefix) {
  const paths = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data: items } = await supabaseAdmin.storage.from("velora-storage").list(prefix, { limit, offset });
    if (!items?.length) break;

    for (const item of items) {
      const fullPath = `${prefix}${item.name}`;
      if (item.id) {
        paths.push(fullPath);
      } else {
        const subPaths = await walkAllPaths(`${fullPath}/`);
        paths.push(...subPaths);
      }
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return paths;
}

export async function deleteProjectFiles(userId, projectId) {
  if (!isConfigured) return { success: true };
  const paths = await walkAllPaths(`users/${userId}/projects/${projectId}/`);
  if (paths.length) {
    await supabaseAdmin.storage.from("velora-storage").remove(paths);
  }
  return { success: true };
}

export async function deleteUserFiles(userId) {
  if (!isConfigured) return { success: true };
  const paths = await walkAllPaths(`users/${userId}/`);
  if (paths.length) {
    await supabaseAdmin.storage.from("velora-storage").remove(paths);
  }
  return { success: true };
}

export async function uploadThumbnail(buffer, userId, projectId, fileName) {
  const path = `users/${userId}/projects/${projectId}/thumbnails/${fileName}`;
  if (!isConfigured) return { path, url: `https://mock.storage/${path}` };

  const { error } = await supabaseAdmin.storage.from("velora-storage").upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return { path, url: await getPublicUrl("velora-storage", path) };
}
