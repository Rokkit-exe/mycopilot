// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import ViewProvider from './ViewProvider';


export function activate(context: vscode.ExtensionContext) {
  // Register the custom view
  const myViewProvider = new ViewProvider(context.extensionUri, context);
  context.subscriptions.push(
	vscode.window.registerWebviewViewProvider(
	  "deepseek", // This ID must match the one defined in package.json
	  myViewProvider
	)
  );
}

export function deactivate() {}

