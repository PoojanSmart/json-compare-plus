import * as vscode from "vscode";
import * as jmespath from "jmespath";

export async function getFilterDisposable() {
    return vscode.commands.registerCommand("jsoneditor.filter", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found!");
            return;
        }

        let json: any;
        try {
            json = JSON.parse(editor.document.getText());
        } catch (e) {
            vscode.window.showErrorMessage("Invalid JSON in file!");
            return;
        }

        const query = await vscode.window.showInputBox({
            prompt: "Enter JMSPath query",
            placeHolder: "e.g. people[?age > `30`]"
        });

        if (!query) return;

        try {
            const result = jmespath.search(json, query);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(editor.document.uri,
                new vscode.Range(0, 0, editor.document.lineCount, 0),
                JSON.stringify(result, null, 2)
            );
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage("✅ JSON filtered using JMSPath");
        } catch (err: any) {
            vscode.window.showErrorMessage("Error running JMSPath: " + err.message);
        }
    });

}