import { Uri } from 'vscode';
import { RequestType0, RequestType } from "vscode-jsonrpc";
import { TextDocumentIdentifier, TextDocumentPositionParams } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";

export namespace JarClassContentsRequest {
    export const type = new RequestType<TextDocumentIdentifier, string, void>("kotlin/jarClassContents");
}

export namespace MainClassRequest {
    export const type = new RequestType<TextDocumentIdentifier, any, void>("kotlin/mainClass");
}

export namespace OverrideMemberRequest {
    export const type = new RequestType<TextDocumentPositionParams, any[], void>("kotlin/overrideMember");
}

export namespace BuildOutputLocationRequest {
    export const type = new RequestType0<string, void>("kotlin/buildOutputLocation");
}

export class KotlinApi {
    private client: LanguageClient;
    private openedFiles: Set<string> = new Set();
    private documentVersions: Map<string, number> = new Map();

    constructor(client: LanguageClient) {
        this.client = client;
    }

    private getNextVersion(uri: string): number {
        const currentVersion = this.documentVersions.get(uri) || 0;
        const nextVersion = currentVersion + 1;
        this.documentVersions.set(uri, nextVersion);
        return nextVersion;
    }

    async getBuildOutputLocation(): Promise<string> {
        return await this.client.sendRequest(BuildOutputLocationRequest.type);
    }

    async forceDocumentReload(uri: Uri | string, content: string): Promise<void> {
        const uriString = uri instanceof Uri ? uri.toString() : uri;
        if (this.openedFiles.has(uriString)) {
            await this.notifyFileClosed(uriString);
        }
        await this.notifyFileOpened(uriString, content);
    }

    async refreshBazelClassPath(documentUri?: Uri | string, content?: string): Promise<void> {
        await this.client.sendRequest("workspace/executeCommand", {
            command: "kotlinRefreshBazelClassPath",
            arguments: []
        });

        if (documentUri && content) {
            await this.forceDocumentReload(documentUri, content);
        }
    }

    async notifyFileOpened(uri: Uri | string, content: string): Promise<void> {
        const uriString = uri instanceof Uri ? uri.toString() : uri;
        if (this.openedFiles.has(uriString)) {
            return;
        }

        this.client.sendNotification("textDocument/didOpen", {
            textDocument: {
                uri: uriString,
                languageId: "kotlin",
                version: this.getNextVersion(uriString),
                text: content
            }
        });
        
        this.openedFiles.add(uriString);
    }

    async notifyFileClosed(uri: Uri | string): Promise<void> {
        const uriString = uri instanceof Uri ? uri.toString() : uri;
        if (!this.openedFiles.has(uriString)) {
            return;
        }

        this.client.sendNotification("textDocument/didClose", {
            textDocument: { uri: uriString }
        });
        
        this.openedFiles.delete(uriString);
        this.documentVersions.delete(uriString);
    }
}
