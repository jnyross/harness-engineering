import PromptDialog from "@mariozechner/mini-lit/dist/PromptDialog.js";
import { i18n } from "./i18n.js";

const ENCRYPTED_TOKEN_KEY = "auth-token";
let encryptionKey: CryptoKey | null = null;

async function getEncryptionKey(): Promise<CryptoKey> {
	if (encryptionKey) return encryptionKey;

	const keyData = sessionStorage.getItem("auth-token-key");
	if (keyData) {
		const rawKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
		encryptionKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
	} else {
		encryptionKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
		const exported = await crypto.subtle.exportKey("raw", encryptionKey);
		const rawKey = new Uint8Array(exported);
		sessionStorage.setItem("auth-token-key", btoa(String.fromCharCode(...rawKey)));
	}

	return encryptionKey;
}

async function encryptToken(token: string): Promise<string> {
	const key = await getEncryptionKey();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(token);
	const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
	const combined = new Uint8Array(iv.length + encrypted.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(encrypted), iv.length);
	return btoa(String.fromCharCode(...combined));
}

async function decryptToken(encryptedData: string): Promise<string | null> {
	try {
		const key = await getEncryptionKey();
		const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
		const iv = combined.slice(0, 12);
		const encrypted = combined.slice(12);
		const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
		return new TextDecoder().decode(decrypted);
	} catch {
		return null;
	}
}

export async function getAuthToken(): Promise<string | undefined> {
	const encrypted = localStorage.getItem(ENCRYPTED_TOKEN_KEY);
	if (encrypted) {
		const token = await decryptToken(encrypted);
		if (token) return token;
	}

	while (true) {
		const authToken = (
			await PromptDialog.ask(i18n("Enter Auth Token"), i18n("Please enter your auth token."), "", true)
		)?.trim();
		if (authToken) {
			const encryptedToken = await encryptToken(authToken);
			localStorage.setItem(ENCRYPTED_TOKEN_KEY, encryptedToken);
			break;
		}
	}
	return (await decryptToken(localStorage.getItem(ENCRYPTED_TOKEN_KEY)!)) || undefined;
}

export async function clearAuthToken() {
	localStorage.removeItem(ENCRYPTED_TOKEN_KEY);
	sessionStorage.removeItem("auth-token-key");
	encryptionKey = null;
}
