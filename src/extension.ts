import * as vscode from "vscode";
import { getFilterDisposable } from "./filter";
import { getCompareDisposable, getChangeListener, getDocumentCloseListener } from "./compare";

export async function activate(context: vscode.ExtensionContext) {
    const filterDisposable = await getFilterDisposable();
    const compareDisposable = await getCompareDisposable();
    const changeListener = await getChangeListener();
    const documentCloseListener = await getDocumentCloseListener();
    context.subscriptions.push(compareDisposable, filterDisposable, changeListener, documentCloseListener);
}

export function deactivate() { }