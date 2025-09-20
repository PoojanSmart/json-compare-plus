import * as vscode from "vscode";
import parse, { ArrayNode, LiteralNode, ObjectNode } from "json-to-ast";

let leftEditor: vscode.TextEditor | undefined;
let rightEditor: vscode.TextEditor | undefined;

export async function getCompareDisposable() {
    return vscode.commands.registerCommand("jsoneditor.compare", async () => {
        vscode.window.visibleTextEditors.forEach(editor => {
            if (editor.document.languageId === "json") {
                if (!leftEditor && editor !== rightEditor) leftEditor = editor;
                else if (editor !== leftEditor) rightEditor ??= editor;
            }
        });
        if (!leftEditor) {
            const leftDoc = await vscode.workspace.openTextDocument({ language: "json", content: "" });
            leftEditor = await vscode.window.showTextDocument(leftDoc, { viewColumn: vscode.ViewColumn.One, preserveFocus: true });
        }
        if (!rightEditor) {
            const rightDoc = await vscode.workspace.openTextDocument({ language: "json", content: "" });
            rightEditor = await vscode.window.showTextDocument(rightDoc, { viewColumn: vscode.ViewColumn.Two, preserveFocus: true });
        }
        vscode.window.showInformationMessage("Compare your JSONs");
    });
}

export async function getChangeListener() {
    return vscode.workspace.onDidChangeTextDocument(async (e) => {
        if (leftEditor && rightEditor) {
            if (e.document === leftEditor?.document || e.document === rightEditor?.document) {
                await runComparision();
            }
        }
    });
}

export async function getDocumentCloseListener() {
    return vscode.window.onDidChangeVisibleTextEditors(async (editors) => {

        if (leftEditor && !editors.includes(leftEditor)) {
            leftEditor = rightEditor;
            rightEditor = undefined;
        }
        if (rightEditor && !editors.includes(rightEditor)) {
            rightEditor = undefined;
        }
    });
}


async function runComparision() {
    const jsondiffpatch = await import('jsondiffpatch');

    const [left, right] = vscode.window.visibleTextEditors.filter(
        e => e.document.languageId === "json"
    );

    if (!left || !right) return;
    try {
        const leftJson = JSON.parse(left.document.getText() || "{}");
        const rightJson = JSON.parse(right.document.getText() || "{}");

        const delta = jsondiffpatch.diff(leftJson, rightJson);
        if (!delta) {
            clearHighlights(left);
            clearHighlights(right);
            return;
        }

        const leftAst = parse(left.document.getText(), { loc: true });
        const rightAst = parse(right.document.getText(), { loc: true });

        const [leftGreens, leftReds] = highlightDifferences(leftJson, rightJson, leftAst);

        left.setDecorations(greenDecoration, leftGreens);
        left.setDecorations(redDecoration, leftReds);
        const [rightGreens, rightReds] = highlightDifferences(rightJson, leftJson, rightAst);
        right.setDecorations(greenDecoration, rightGreens);
        right.setDecorations(redDecoration, rightReds); 
    } catch (err: any) {
        vscode.window.showErrorMessage("Invalid JSON: " + err.message);
    }
}

function clearHighlights(editor: vscode.TextEditor) {
    editor.setDecorations(greenDecoration, []);
    editor.setDecorations(redDecoration, []);
}

const greenDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(76, 175, 80, 0.15)", // soft green
    border: "1px solid rgba(76, 175, 80, 0.7)",
    borderRadius: "2px",
    overviewRulerLane: vscode.OverviewRulerLane.Full,
    overviewRulerColor: "rgba(76,175,80,0.8)"

});

const redDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgba(244, 67, 54, 0.15)", // soft red
    border: "1px solid rgba(244, 67, 54, 0.7)",
    borderRadius: "2px",
    overviewRulerLane: vscode.OverviewRulerLane.Full,
    overviewRulerColor: "rgba(244,67,54,0.8)"
});

function highlightDifferences(
    json: any,
    otherJson: any,
    ast: any
): [vscode.Range[], vscode.Range[]] {
    const greens: vscode.Range[] = [];
    const reds: vscode.Range[] = [];

    if (ast.type !== "Object") return [greens, reds];

    for (const prop of ast.children) {
        const key = prop.key.value;
        const node = prop.value;

        if (node.type === "Object") {
            if (key in otherJson && typeof otherJson[key] === "object") {
                const [childGreens, childReds] = highlightDifferences(json[key], otherJson[key], node);
                greens.push(...childGreens);
                reds.push(...childReds);
            }
            else {
                const range = new vscode.Range(
                    prop.key.loc.start.line - 1, prop.key.loc.start.column - 1,
                    node.loc.end.line - 1, node.loc.end.column - 1
                );
                greens.push(range);
            }
        }
        else if (node.type === "Array") {
            if (key in otherJson && Array.isArray(otherJson[key])) {
                for (const child of node.children) {
                    let found = false;
                    for (const otherChild of otherJson[key]) {
                        if (JSON.stringify(astToJson(child)) === JSON.stringify(otherChild)) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        const range = new vscode.Range(
                            child.loc.start.line - 1, child.loc.start.column - 1,
                            child.loc.end.line - 1, child.loc.end.column - 1
                        );
                        greens.push(range);
                    }
                }
            }
            else {
                const range = new vscode.Range(
                    prop.key.loc.start.line - 1, prop.key.loc.start.column - 1,
                    node.loc.end.line - 1, node.loc.end.column - 1
                );
                greens.push(range);
            }
        }
        else if (node.type === "Literal") {
            if (!(key in otherJson)) {
                const range = new vscode.Range(
                    prop.key.loc.start.line - 1, prop.key.loc.start.column - 1,
                    node.loc.end.line - 1, node.loc.end.column - 1
                );
                greens.push(range);
            }
            else if (JSON.stringify(json[key]) !== JSON.stringify(otherJson[key])) {
                const range = new vscode.Range(
                    prop.key.loc.start.line - 1, prop.key.loc.start.column - 1,
                    node.loc.end.line - 1, node.loc.end.column - 1
                );
                reds.push(range);
            }
        }
    }
    return [greens, reds];
}


function astToJson(node: ObjectNode | ArrayNode | LiteralNode): any {
    switch (node.type) {
        case "Object":
            const obj: Record<string, any> = {};
            node.children.forEach(prop => {
                const key = prop.key.value; // property name
                obj[key] = astToJson(prop.value);
            });
            return obj;

        case "Array":
            return node.children.map(child => astToJson(child));

        case "Literal":
            return node.value; // string | number | boolean | null

        default:
            return null;
    }
}
