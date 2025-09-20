import * as vscode from "vscode";
import { getFilterDisposable } from "./filter";
import { getCompareDisposable, getChangeListener } from "./compare";

export async function activate(context: vscode.ExtensionContext) {
    const filterDisposable = await getFilterDisposable();
    const compareDisposable = await getCompareDisposable();
    const changeListener = await getChangeListener();

    context.subscriptions.push(compareDisposable, filterDisposable, changeListener);
}

export function deactivate() { }