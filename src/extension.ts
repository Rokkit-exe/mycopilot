// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import ViewProvider from './ViewProvider';
import {system} from './prompt';
import State from './objects/State';
import Config from './objects/Config';

export function activate(context: vscode.ExtensionContext) {
  // import congifurations
  const config = vscode.workspace.getConfiguration('myCopilot');
  const url = config.get<string>(Config.url, 'http://127.0.0.1:11434');
  let models = config.get<{ name: string, value: string }[]>(Config.models, [{"name": "DeepSeek-r1:14b", "value": "deepseek-r1:14b"}]);
  const systemPrompt = config.get<string>(Config.systemPrompt, system.content);

  // update state with configurations
  context.workspaceState.update(State.url, url);
  context.workspaceState.update(State.models, models);
  context.workspaceState.update(State.systemPrompt, systemPrompt);


  // Register the view provider
  const myViewProvider = new ViewProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "deepseek", // This ID must match the one defined in package.json
      myViewProvider
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(`myCopilot.${Config.url}`)) {
        const newUrl = config.get<string>(Config.url, 'http://127.0.0.1:11434');
        context.workspaceState.update(State.url, newUrl);
      }
      if (event.affectsConfiguration(`myCopilot.${Config.models}`)) {
        const newModels = config.get<{ name: string, value: string }[]>(Config.models, [{ "name": "DeepSeek-r1:14b", "value": "deepseek-r1:14b" }]);
        vscode.window.showInformationMessage('Models updated');
        context.workspaceState.update(State.models, newModels);
      }
      if (event.affectsConfiguration(`myCopilot.${Config.systemPrompt}`)) {
        const newSystemPrompt = config.get<string>(Config.systemPrompt, system.content);
        context.workspaceState.update(State.systemPrompt, newSystemPrompt);
      }
    })
  );
}

export function deactivate() {}

