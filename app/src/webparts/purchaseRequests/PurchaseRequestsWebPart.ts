// The SharePoint Framework entry point. It shows the app full page on the
// Forms and Apps site and in Teams. All screens live in ../../ui; this file only
// connects the app to SharePoint and mounts it.
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { SPHttpClient } from '@microsoft/sp-http';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import { App } from '../../ui/App';
import { SpClient, SpFetch } from '../../data/sharepoint/http';
import { SharePointDataService } from '../../data/sharepoint/SharePointDataService';
import { readerAssetsIn } from '../../reading/assets';
import { createReceiptReader, ReceiptReader } from '../../reading/ReceiptReader';
import logoUrl from '../../ui/assets/clarus-logo.png';

export default class PurchaseRequestsWebPart extends BaseClientSideWebPart<Record<string, never>> {
  private _service: SharePointDataService | undefined;
  private _reader: ReceiptReader | undefined;

  protected onInit(): Promise<void> {
    const client = this.context.spHttpClient;
    // Requests go out as the signed-in user; SPHttpClient adds the sign-in
    // and the request digest SharePoint needs for changes.
    const fetcher: SpFetch = (url, init) =>
      init.method === 'GET'
        ? client.get(url, SPHttpClient.configurations.v1, { headers: init.headers })
        : client.post(url, SPHttpClient.configurations.v1, { headers: init.headers, body: init.body });
    const web = this.context.pageContext.web;
    this._service = new SharePointDataService(new SpClient(fetcher, web.absoluteUrl, web.serverRelativeUrl));
    // The receipt reader's files sit next to this script in the app package
    // (D-074), which is where webpack's public path points.
    this._reader = createReceiptReader(readerAssetsIn(__webpack_public_path__), (reason) =>
      console.warn('Purchase Requests: receipt suggestions could not start in this browser.', reason)
    );
    return Promise.resolve();
  }

  public render(): void {
    if (!this._service) return;
    ReactDom.render(React.createElement(App, { service: this._service, logoUrl, reader: this._reader ?? null }), this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
}
