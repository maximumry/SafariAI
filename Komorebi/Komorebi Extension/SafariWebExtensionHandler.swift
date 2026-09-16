import Foundation
import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem,
              let message = item.userInfo?[SFExtensionMessageKey] as? [String:Any] else {
            finish(context,["ok":false,"error":"メッセージを読み取れませんでした。"]);return
        }
        // Never log message payloads: they may contain page contents or credentials.
        Task {
            do { finish(context,try await AIService.shared.handle(message)) }
            catch { finish(context,["ok":false,"error":(error as? AIError)?.message ?? "処理に失敗しました。設定を確認して再試行してください。"] ) }
        }
    }
    private func finish(_ context: NSExtensionContext, _ result: [String:Any]) {
        let response = NSExtensionItem();response.userInfo = [SFExtensionMessageKey:result]
        context.completeRequest(returningItems:[response],completionHandler:nil)
    }
}
