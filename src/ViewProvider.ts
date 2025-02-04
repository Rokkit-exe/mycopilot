import { Ollama } from 'ollama';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import OllamaModel from './objects/OllamaModel';
import Message from './objects/Message';
import State from './objects/State';
import Config from './objects/Config';

// Define the WebviewViewProvider
class ViewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private _context: vscode.ExtensionContext;
    private _serverUrl: string;
    private _models: OllamaModel[];
    private _model: string;
    private _systemPrompt: string;

	constructor(
        private readonly _extensionUri: vscode.Uri, 
        private context: vscode.ExtensionContext,
    ) {
		this._context = context;
        this._serverUrl = this._context.workspaceState.get(State.url) || Config.defaultUrl;
        this._models = this._context.workspaceState.get(State.models) || Config.defaultModels;
        this._model = this._models[0].value;
        this._systemPrompt = this._context.workspaceState.get(State.systemPrompt) || Config.defaultSystemPrompt;
	}

    updateMessageState(message: Message) {
        const messageState = this._context.workspaceState.get<Message[]>(State.messages) || [];
        if (messageState.length >= 10) {
            messageState.shift();
        }
        messageState.push(message);
        this._context.workspaceState.update(State.messages, messageState);
    }

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;

		// Set HTML content for the Webview
		webviewView.webview.options = {
		    enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(this._context.extensionPath, 'src'))]
		};

        const messages = this._context.workspaceState.get<Message[]>(State.messages) || [];

        // Get URIs for CSS and JavaScript files
        const cssUri = webviewView.webview.asWebviewUri(
            vscode.Uri.file(path.join(this._context.extensionPath, "src", "view.css"))
        );
        const jsUri = webviewView.webview.asWebviewUri(
            vscode.Uri.file(path.join(this._context.extensionPath, "src", "view.js"))
        );

        webviewView.webview.html = this.getViewContent(cssUri.toString(), jsUri.toString());

        this.sendState(messages, this._models, webviewView);

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                const messages = this._context.workspaceState.get<Message[]>(State.messages) || [];
                this.sendState(messages, this._models, webviewView);
            }
        });

		webviewView.webview.onDidReceiveMessage(async (message: any) => {
            if (message.command === 'clear') {
                this.clearMessages();
            }
            if (message.command === 'model') {
                this.updateModel(message);
            }
            if (message.command === 'send') {
                this.sendPrompt(message, webviewView);
            }
        },
            undefined,
            this.context.subscriptions
        );
    }

    

    sendState(messages: Message[], models: OllamaModel[], webviewView: vscode.WebviewView) {
        for (const message of messages) {
            if (message.role === 'user') {
                webviewView.webview.postMessage({ command: 'userMessage', text: message.content });
            }
            if (message.role === 'assistant') {
                webviewView.webview.postMessage({ command: 'assistantMessage', text: message.content });
            }
        }
        webviewView.webview.postMessage({ command: 'models', text: models });
    }

    clearMessages() {
        this._context.workspaceState.update(State.messages, undefined);
        const messages = this._context.workspaceState.get<Message[]>(State.messages, []);
        vscode.window.showInformationMessage(messages.length.toString());
    }

    updateModel(message: any) {
        vscode.window.showInformationMessage(`Model changed to ${message.text}`);
        this._model = message.text;
    }

    async sendPrompt(message: any, webviewView: vscode.WebviewView) {
        const userPrompt = message.text;
                
                this.updateMessageState(new Message('user', userPrompt));

                let responseText = '';
                let thinking = false;

                try {
                    const ollama = new Ollama({ host: this._serverUrl });
                    vscode.window.showInformationMessage(`Connecting to ${this._model} ...`);
                    const streamResponse = await ollama.chat({
                        model: this._model, 
                        messages: [
                            {role: "system", content: this._systemPrompt}, 
                            {role: 'user', content: userPrompt}
                        ],
                        stream: true
                    });

                    for await (const chunk of streamResponse) {
                        if (chunk.message.content.includes('<think>')) {
                            thinking = true;
                        }
                        if (chunk.message.content.includes('</think>')) {
                            thinking = false;
                        }
                        else if (!thinking) {
                            responseText += chunk.message.content;
                            webviewView.webview.postMessage({ command: 'chatResponse', text: responseText });
                        }
                    }
                } catch (error: any) {
                    webviewView.webview.postMessage({ command: 'chatResponse', text: `Error: ${String(error)}` });
                }

                this.updateMessageState(new Message('assistant', responseText));
    }

    // getting the content of view.html
    getViewContent(cssUri: string, jsUri: string): string {
        return /*html*/`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Deep Seek Chat</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.6/marked.min.js" integrity="sha512-rvRITpPeEKe4hV9M8XntuXX6nuohzqdR5O3W6nhjTLwkrx0ZgBQuaK4fv5DdOWzs2IaXsGt5h0+nyp9pEuoTXg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/themes/prism-tomorrow.min.css" integrity="sha512-kSwGoyIkfz4+hMo5jkJngSByil9jxJPKbweYec/UgS+S1EgE45qm4Gea7Ks2oxQ7qiYyyZRn66A9df2lMtjIsw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/prism.min.js" integrity="sha512-UOoJElONeUNzQbbKQbjldDf9MwOHqxNz49NNJJ1d90yp+X9edsHyJoAs6O4K19CZGaIdjI5ohK+O2y5lBTW6uQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-python.min.js" integrity="sha512-3qtI9+9JXi658yli19POddU1RouYtkTEhTHo6X5ilOvMiDfNvo6GIS6k2Ukrsx8MyaKSXeVrnIWeyH8G5EOyIQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-jsx.min.js" integrity="sha512-02Ybjxfrp2RGVCd29o1Didkx6lAD2yQRW4vOqCzpEWsqfRay1FhN6G4FFPSGu6ER01RAWjLPVraD9tixC5Sbow==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-javascript.min.js" integrity="sha512-yvw5BDA/GQu8umskpIOBhX2pDLrdOiriaK4kVxtD28QEGLV5rscmCfDjkrx52tIgzLgwzs1FsALV6eYDpGnEkQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-java.min.js" integrity="sha512-BEknrL2CnuVpqnSTwO4a9y9uW5bQ/nabkJeahZ5seRXvmzAMq59Ja9OxZe3lVGrnKEcVlamL4nUBl03wzPM/nA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-go.min.js" integrity="sha512-19J5mMl3tkNptyMFkeBLHmdNi6f6l7quYk69/kiTgk4UNmxRCkdVCMkqPvoAQ7CE6fZQzz7Hp8VECXDpi7g5mw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-git.min.js" integrity="sha512-IA8F5MWIR8Q800FHcywXEMvVSPqdCtQSTwFQIN4hN7rha6e9UVavPsyVavQ4ig4xE+2zlo8IV2ykF7JJD5FPDA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-css.min.js" integrity="sha512-mHqYW9rlMztkE8WFB6wIPNWOVtQO50GYBsBRMyA1CMk34zLJ6BrvVy3RVHoIIofugmnoNLGxkuePQ9VT2a3u8w==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-csharp.min.js" integrity="sha512-lNcWxx1oz89gefDhnB9knOCI/GcjlFNZq7ik92IA9AdKVamhge7Z9Ne3MSAim/wPdTrthGF0iQMs19z1WS9gFw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-cpp.min.js" integrity="sha512-/kakiUcgosfrW14dYIe0cMjXoK6PN67r96Dz2zft/Rlm6TcgdCJjb6ZD/jpobHzduAs8NdSeMQHda8iJGkjdow==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-c.min.js" integrity="sha512-EWIJI7uQnA8ClViH2dvhYsNA7PHGSwSg03FAfulqpsFiTPHfhdQIvhkg/l3YpuXOXRF2Dk0NYKIl5zemrl1fmA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-bash.min.js" integrity="sha512-35RBtvuCKWANuRid6RXP2gYm4D5RMieVL/xbp6KiMXlIqgNrI7XRUh9HurE8lKHW4aRpC0TZU3ZfqG8qmQ35zA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/components/prism-aspnet.min.js" integrity="sha512-J9vX+cO8Jnj0J63fUC5stcyzhiqBOD4gkeIVUDIPGU2+rVWVb2bkC8VNsF/i9XP1MuPCzfW+Mc9eiT6BzAYW8w==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <link rel="stylesheet" href="${cssUri}"/>
        </head>
        <body>
            <div class="title_container">
                <h2>Deep Seek Chat</h2>
                <select id="model" class="model_select">
                    
                </select>
                <button id="clear" class="clear_button">Clear Chat</button>
            </div>
            <div class="main_container">
                <div id="chat" class="chat_container">
                </div>
                <div class="prompt_container">
                    <textarea id="prompt" cols="50" rows="3" placeholder="Ask me anything ..."></textarea>
                    <svg id="send" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-send send_icon" viewBox="0 0 16 16">
                        <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z"/>
                    </svg>
                </div>
            </div>
            <script src="${jsUri}"></script>
        </body>
        </html>`;
    }
}

export default ViewProvider;