import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
let configured = false;

if (url && key && !url.includes("your_")) {
  supabase = createClient(url, key);
  configured = true;
}

function createMockChain(data = null, error = null) {
  const chain = {
    data,
    error,
    eq: () => chain,
    select: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    single: () => Promise.resolve({ data, error }),
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    catch: () => chain,
    then: (resolve) => Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

function mockClient() {
  return {
    from: () => createMockChain([], null),
    insert: () => Promise.resolve(createMockChain(null, null)),
    update: () => createMockChain(null, null),
    delete: () => createMockChain(null, null),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () => Promise.resolve({ data: { text: () => Promise.resolve("WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\n \n") }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/mock.mp4" } }),
        createSignedUrl: () => ({ data: { signedUrl: "https://example.com/signed.mp4" } }),
      }),
    },
  };
}

export const supabaseAdmin = supabase || mockClient();
export const isConfigured = configured;