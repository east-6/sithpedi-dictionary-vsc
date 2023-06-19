import * as vscode from 'vscode';
import nodeFetch from 'node-fetch';
import { RequestInfo, RequestInit } from 'node-fetch';
const fetch = (...args: [RequestInfo, RequestInit?]) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function fetchTranslations() {
    const response = await fetch('https://starwars.fandom.com/tr/wiki/Modül:Sozluk/Maddeler?action=raw');

    if (!response.ok) {
        throw new Error('Failed to fetch translations');
    }

    const rawText = await response.text();

    const {translations, reverseTranslations} = parseTranslations(rawText);

    return {translations, reverseTranslations};
}

function parseTranslations(rawText: string) {
    const lines = rawText.split('\n');
    const translations: {[key: string]: string} = {};
    const reverseTranslations: {[key: string]: string} = {}; // English to Turkish translations

    const keyValueRegex = /\['(.+?)'\] = '(.+?)'/;

    lines.forEach(line => {
        const match = line.match(keyValueRegex);
        if (match) {
            translations[match[1]] = match[2];
            reverseTranslations[match[2].toLowerCase()] = match[1];
        }
    });

    return {translations, reverseTranslations};
}

function getTranslation(selectedText: string, {translations, reverseTranslations}: {translations: {[key: string]: string}, reverseTranslations: {[key: string]: string}}) {
    const lowerSelectedText = selectedText.toLowerCase();

    // Direct translation
    const directTranslation = translations[lowerSelectedText];
    const reverseDirectTranslation = reverseTranslations[lowerSelectedText];
    if (directTranslation) {
        return directTranslation;
    }
    if (reverseDirectTranslation) {
        return reverseDirectTranslation;
    }

    // Find closest translation
    let closestKey: string | undefined;
    let closestDistance: number = Infinity;

    for (const key in translations) {
        const distance = levenshtein(lowerSelectedText, key.toLowerCase());
        if (distance < closestDistance) {
            closestDistance = distance;
            closestKey = key;
        }
    }

    if (closestKey) {
        return translations[closestKey];
    } else {
        return 'No translation found';
    }
}

function levenshtein(a: string, b: string) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('sithpedi-dictionary.translate', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return; // No open text editor
        }
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        try {
            const { translations, reverseTranslations } = await fetchTranslations();

            if (!translations) {
                throw new Error('Çeviri mevcut değil, lütfen çevir ve lütfen sözlüğe ekle');
            }

            const translation = getTranslation(selectedText, { translations, reverseTranslations });

            const notificationMessage = `𝗧𝗿𝗮𝗻𝘀𝗹𝗮𝘁𝗶𝗼𝗻: ${translation} — 𝗦𝗲𝗮𝗿𝗰𝗵𝗲𝗱 𝘁𝗲𝗿𝗺: ${selectedText}`;
            vscode.window.showInformationMessage(notificationMessage);
        } catch (error) {
			vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}