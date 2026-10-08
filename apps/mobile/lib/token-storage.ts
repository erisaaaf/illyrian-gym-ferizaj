import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// On iOS/Android tokens live in the Keychain/Keystore via expo-secure-store -
// never AsyncStorage or plain files. SecureStore has no web implementation, so
// the browser build (used only to preview/test the app on a desktop) falls
// back to sessionStorage, which is cleared when the tab closes. The product
// ships as a native app; do not treat the web build as production.
const ACCESS_KEY = "illyrian_access_token";
const REFRESH_KEY = "illyrian_refresh_token";

const isWeb = Platform.OS === "web";

async function get(key: string): Promise<string | null> {
  if (isWeb) return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function set(key: string, value: string): Promise<void> {
  if (isWeb) {
    sessionStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function remove(key: string): Promise<void> {
  if (isWeb) {
    sessionStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  getAccessToken: () => get(ACCESS_KEY),
  getRefreshToken: () => get(REFRESH_KEY),
  async setTokens(accessToken: string, refreshToken: string) {
    await Promise.all([set(ACCESS_KEY, accessToken), set(REFRESH_KEY, refreshToken)]);
  },
  async clear() {
    await Promise.all([remove(ACCESS_KEY), remove(REFRESH_KEY)]);
  },
};
