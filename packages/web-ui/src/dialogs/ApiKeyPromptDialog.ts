import { customElement, state } from "lit/decorators.js";
import "../components/ProviderKeyInput.js";
import { DialogContent, DialogHeader } from "@mariozechner/mini-lit/dist/Dialog.js";
import { DialogBase } from "@mariozechner/mini-lit/dist/DialogBase.js";
import { html } from "lit";
import { getAppStorage } from "../storage/app-storage.js";
import { i18n } from "../utils/i18n.js";

@customElement("api-key-prompt-dialog")
export class ApiKeyPromptDialog extends DialogBase {
	@state() private provider = "";

	private resolvePromise?: (success: boolean) => void;
	private unsubscribe?: () => void;
	private settled = false;

	protected modalWidth = "min(500px, 90vw)";
	protected modalHeight = "auto";

	static async prompt(provider: string): Promise<boolean> {
		const dialog = new ApiKeyPromptDialog();
		dialog.provider = provider;
		dialog.open();

		return new Promise((resolve) => {
			dialog.resolvePromise = resolve;
		});
	}

	override async connectedCallback() {
		super.connectedCallback();
		let pollInFlight = false;

		// Poll for key existence - when key is added, resolve and close
		const checkInterval = setInterval(async () => {
			if (!this.isConnected || this.settled || pollInFlight) {
				return;
			}
			pollInFlight = true;
			try {
				const hasKey = !!(await getAppStorage().providerKeys.get(this.provider));
				if (!this.isConnected || this.settled) {
					return;
				}
				if (hasKey) {
					clearInterval(checkInterval);
					this.settle(true);
					this.close();
				}
			} catch (error) {
				if (this.isConnected && !this.settled) {
					console.error("Failed to poll provider key status:", error);
				}
			} finally {
				pollInFlight = false;
			}
		}, 500);

		this.unsubscribe = () => clearInterval(checkInterval);
	}

	override disconnectedCallback() {
		super.disconnectedCallback();
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = undefined;
		}
		this.settle(false);
	}

	private settle(success: boolean): void {
		if (this.settled) {
			return;
		}
		this.settled = true;
		const resolve = this.resolvePromise;
		this.resolvePromise = undefined;
		resolve?.(success);
	}

	override close() {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = undefined;
		}
		super.close();
		this.settle(false);
	}

	protected override renderContent() {
		return html`
			${DialogContent({
				children: html`
					${DialogHeader({
						title: i18n("API Key Required"),
					})}
					<provider-key-input .provider=${this.provider}></provider-key-input>
				`,
			})}
		`;
	}
}
