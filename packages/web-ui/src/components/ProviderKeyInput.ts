import { i18n } from "@mariozechner/mini-lit";
import { Badge } from "@mariozechner/mini-lit/dist/Badge.js";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { type Context, complete, getModel } from "@mariozechner/pi-ai";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getAppStorage } from "../storage/app-storage.js";
import { applyProxyIfNeeded } from "../utils/proxy-utils.js";
import { Input } from "./Input.js";

// Test models for each provider
const TEST_MODELS: Record<string, string> = {
	anthropic: "claude-3-5-haiku-20241022",
	openai: "gpt-4o-mini",
	google: "gemini-2.5-flash",
	groq: "openai/gpt-oss-20b",
	openrouter: "z-ai/glm-4.6",
	"vercel-ai-gateway": "anthropic/claude-opus-4.5",
	cerebras: "gpt-oss-120b",
	xai: "grok-4-fast-non-reasoning",
	zai: "glm-4.5-air",
};

@customElement("provider-key-input")
export class ProviderKeyInput extends LitElement {
	@property() provider = "";
	@state() private keyInput = "";
	@state() private testing = false;
	@state() private failed = false;
	@state() private hasKey = false;
	@state() private inputChanged = false;
	private failureResetTimeout: ReturnType<typeof setTimeout> | undefined;
	private operationSeq = 0;

	protected createRenderRoot() {
		return this;
	}

	override async connectedCallback() {
		super.connectedCallback();
		const operationId = ++this.operationSeq;
		await this.checkKeyStatus(operationId);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.operationSeq++;
		if (this.failureResetTimeout) {
			clearTimeout(this.failureResetTimeout);
			this.failureResetTimeout = undefined;
		}
	}

	private scheduleFailureReset(): void {
		if (this.failureResetTimeout) {
			clearTimeout(this.failureResetTimeout);
		}
		this.failureResetTimeout = setTimeout(() => {
			this.failed = false;
			this.failureResetTimeout = undefined;
			this.requestUpdate();
		}, 5000);
	}

	private async checkKeyStatus(operationId: number = this.operationSeq) {
		try {
			const key = await getAppStorage().providerKeys.get(this.provider);
			if (!this.isConnected || operationId !== this.operationSeq) {
				return;
			}
			this.hasKey = !!key;
		} catch (error) {
			console.error("Failed to check key status:", error);
		}
	}

	private async testApiKey(provider: string, apiKey: string): Promise<boolean> {
		try {
			const modelId = TEST_MODELS[provider];
			// Returning true here for Ollama and friends. Can' know which model to use for testing
			if (!modelId) return true;

			// biome-ignore lint/suspicious/noExplicitAny: migration
			let model = getModel(provider as any, modelId);
			if (!model) return false;

			// Get proxy URL from settings (if available)
			const proxyEnabled = await getAppStorage().settings.get<boolean>("proxy.enabled");
			const proxyUrl = await getAppStorage().settings.get<string>("proxy.url");

			// Apply proxy only if this provider/key combination requires it
			model = applyProxyIfNeeded(model, apiKey, proxyEnabled ? proxyUrl || undefined : undefined);

			const context: Context = {
				messages: [{ role: "user", content: "Reply with: ok", timestamp: Date.now() }],
			};

			const result = await complete(model, context, {
				apiKey,
				maxTokens: 200,
				// biome-ignore lint/suspicious/noExplicitAny: migration
			} as any);

			return result.stopReason === "stop";
		} catch (error) {
			console.error(`API key test failed for ${provider}:`, error);
			return false;
		}
	}

	private async saveKey() {
		if (!this.keyInput) return;
		const operationId = ++this.operationSeq;

		this.testing = true;
		this.failed = false;

		const success = await this.testApiKey(this.provider, this.keyInput);
		if (!this.isConnected || operationId !== this.operationSeq) {
			return;
		}

		this.testing = false;

		if (success) {
			try {
				await getAppStorage().providerKeys.set(this.provider, this.keyInput);
				if (!this.isConnected || operationId !== this.operationSeq) {
					return;
				}
				this.hasKey = true;
				this.inputChanged = false;
				this.requestUpdate();
			} catch (error) {
				if (!this.isConnected || operationId !== this.operationSeq) {
					return;
				}
				console.error("Failed to save API key:", error);
				this.failed = true;
				this.scheduleFailureReset();
			}
		} else {
			if (!this.isConnected || operationId !== this.operationSeq) {
				return;
			}
			this.failed = true;
			this.scheduleFailureReset();
		}
	}

	render() {
		return html`
			<div class="space-y-3">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium capitalize text-foreground">${this.provider}</span>
					${
						this.testing
							? Badge({ children: i18n("Testing..."), variant: "secondary" })
							: this.hasKey
								? html`<span class="text-green-600 dark:text-green-400">✓</span>`
								: ""
					}
					${this.failed ? Badge({ children: i18n("✗ Invalid"), variant: "destructive" }) : ""}
				</div>
				<div class="flex items-center gap-2">
					${Input({
						type: "password",
						placeholder: this.hasKey ? "••••••••••••" : i18n("Enter API key"),
						value: this.keyInput,
						onInput: (e: Event) => {
							this.keyInput = (e.target as HTMLInputElement).value;
							this.inputChanged = true;
							this.requestUpdate();
						},
						className: "flex-1",
					})}
					${Button({
						onClick: () => this.saveKey(),
						variant: "default",
						size: "sm",
						disabled: !this.keyInput || this.testing || (this.hasKey && !this.inputChanged),
						children: i18n("Save"),
					})}
				</div>
			</div>
		`;
	}
}
