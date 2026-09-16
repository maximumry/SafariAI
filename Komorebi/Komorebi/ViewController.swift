//
//  ViewController.swift
//  Komorebi
//
//  Created by 川口 亮 on 2026/09/16.
//

import Cocoa
import SafariServices
import WebKit

let extensionBundleIdentifier = "com.komorebi.SafariAI.Extension"

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show(\(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show(\(state.isEnabled), false)")
                }
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if (message.body as? String != "open-preferences") {
            return;
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            DispatchQueue.main.async {
                if error != nil {
                    let alert = NSAlert(); alert.messageText = "Safariの設定を開けませんでした"; alert.informativeText = "Safari → 設定 → 機能拡張からKomorebiを有効にしてください。開発用ビルドが表示されない場合は、Safariの開発者設定で署名されていない機能拡張の許可が必要です。継続利用にはXcodeで開発者署名を設定できます。"; alert.runModal()
                }
            }
        }
    }

}
