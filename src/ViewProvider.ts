import ollama from 'ollama';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { system } from './prompt';

// Define the WebviewViewProvider
class ViewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	private _context: vscode.ExtensionContext;

	constructor(private readonly _extensionUri: vscode.Uri, private context: vscode.ExtensionContext) {
		this._context = context;
	}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;

		// Set HTML content for the Webview
		webviewView.webview.options = {
		enableScripts: true
		};

		const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'view.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        const deepseekIconPath = path.join(this._extensionUri.fsPath, 'src', 'deepseek.png');
        const deepseekIcon = fs.readFileSync(deepseekIconPath, 'utf8');
        const boyIconPath = path.join(this._extensionUri.fsPath, 'src', 'boy.png');
        const boyIcon = fs.readFileSync(boyIconPath, 'utf8');
        const loadingAnimationPath = path.join(this._extensionUri.fsPath, 'src', 'loading.webm');
        const loadingAnimation = fs.readFileSync(loadingAnimationPath, 'utf8');



        webviewView.webview.html = this.getViewContent();

		webviewView.webview.onDidReceiveMessage(async (message: any) => {
            if (message.command === 'send') {
                const userPrompt = message.text;
                vscode.window.showInformationMessage(userPrompt);
                let responseText = '';
                let thinking = true;

                try {
                    const streamResponse = await ollama.chat({
                        model: 'deepseek-r1:14b', 
                        messages: [system, {role: 'user', content: userPrompt}],
                        stream: true
                    });

                    for await (const chunk of streamResponse) {
                        if (chunk.message.content.includes('</think>')) {
                            thinking = false;
                        }
                        else if (thinking) {
                            webviewView.webview.postMessage({ command: 'chatResponse', text: "# thinking ..." });
                        }
                        else {
                            responseText += chunk.message.content;
                            webviewView.webview.postMessage({ command: 'chatResponse', text: responseText });
                        }
                    }
                } catch (error: any) {
                    webviewView.webview.postMessage({ command: 'chatResponse', text: `Error: ${String(error)}` });
                }
            }
        },
            undefined,
            this.context.subscriptions
        );
		}

    getViewContent() {
        return /*html*/`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Deep Seek Chat</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.6/lib/marked.umd.min.js" integrity="sha512-rh4p4HToku9wx3xLU9ImyBLgRx6ulFCoxvXmTzMSktlSkMdrWRtaytKfFS8RYhSfldst0uccA6Bgt/mXJjKsFA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
            <style>
                .main_container {
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 1rem;
                    height: 90vh;
                }

                .chat_container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    overflow-y: scroll;
                }

                .prompt_container {
                    display: flex;
                    flex-direction: row;
                    flex: end;
                    justify-content: center;
                    align-items: center;
                    background-color: #212121;
                    height: 4rem;
                    margin-top: 1rem;
                }

                .send_button {
                    margin: 0;
                    background-color: #4d6aff;
                }

                .user_message {
                    margin: 0;
                }

                .assistant_message {
                    margin: 0;
                }

                .icon {
                    width: 50px;
                    height: 50px;
                }

                textarea {
                    background-color: #212121;
                    color: white;
                    border: none;
                    resize: none;
                    font-size: 1rem;
                    padding: 0.5rem;
                    margin: 0.5rem;
                    width: 80%;
                    height: 2rem;
                }
            </style>
        </head>
        <body>
            <h2>Deep Seek Chat</h2>
            <div class="main_container">
                <div id="chat" class="chat_container">
                    <div id="response"></div>
                </div>
                <div class="prompt_container">
                    <textarea id="prompt" cols="50" rows="3" placeholder="Ask me anything ..."></textarea>
                    <button id="send">Send</button>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('send').addEventListener('click', () => {
                    console.log('send clicked');
                    const text = document.getElementById('prompt').value;
                    vscode.postMessage({
                        command: 'send',
                        text
                    });
                });

                window.addEventListener('message', event => {
                    const { command, text } = event.data;
                    if (command === 'chatResponse') {
                        document.getElementById('response').innerHTML = marked.parse(text);
                    }
                });
            </script>
        </body>
        </html>`;
    }
}

export default ViewProvider;