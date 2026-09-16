import Foundation
import FoundationModels

actor AIService {
    static let shared = AIService()
    private var localBusy = false
    private var activeCloudRequests = 0
    func localStatus() -> (Bool,String) {
        guard #available(macOS 26.0, *) else { return (false,"オンデバイスAIにはmacOS 26以降とApple Intelligence対応Macが必要です。") }
        switch SystemLanguageModel.default.availability {
        case .available: return (true,"")
        case .unavailable(.appleIntelligenceNotEnabled): return (false,"システム設定でApple Intelligenceを有効にしてください。")
        case .unavailable(.modelNotReady): return (false,"Apple Intelligenceのモデルを準備中です。ダウンロード完了後に再試行してください。")
        case .unavailable(.deviceNotEligible): return (false,"このMacはApple Intelligenceの対応機種ではありません。クラウド接続を設定できます。")
        default: return (false,"現在Apple Intelligenceを利用できません。システム設定を確認してください。")
        }
    }
    func status(includeConfig: Bool) -> [String:Any] {
        let store = SettingsStore(), local = localStatus()
        var providers: [String:Any] = ["local":["ready":local.0]]
        for p in Provider.allCases where p != .local {
            let c = store.config(p)
            providers[p.rawValue] = ["ready":!c.model.isEmpty && ((try? KeychainStore.read(c.account)) ?? nil) != nil]
        }
        var result: [String:Any] = ["ok":true,"localAvailable":local.0,"localReason":local.1,"providers":providers,"defaultProvider":store.defaultProvider.rawValue]
        if includeConfig { result["configs"] = store.publicConfigs() }
        return result
    }
    func handle(_ message: [String:Any]) async throws -> [String:Any] {
        switch message["type"] as? String {
        case "STATUS": return status(includeConfig:false)
        case "CONFIG": return status(includeConfig:true)
        case "SAVE_CONFIG": try SettingsStore().save(message);return ["ok":true]
        case "ASK": return try await ask(AskRequest(message))
        case "TEST":
            let req = try AskRequest(["provider":message["provider"] as? String ?? "local","question":"接続テストです。「接続OK」とだけ答えてください。","context":[:]])
            return try await ask(req)
        default: throw AIError("対応していない操作です。")
        }
    }
    func ask(_ request: AskRequest) async throws -> [String:Any] {
        let local = request.provider == .local
        let (prompt, clipped) = PromptBuilder.prompt(request,local:local)
        let answer: String
        if local {
            let available = localStatus();guard available.0 else { throw AIError(available.1) }
            guard !localBusy else { throw AIError("別のタブでApple Intelligenceが回答中です。少し待って再試行してください。") }
            localBusy = true;defer { localBusy = false }
            if #available(macOS 26.0, *) {
                // One isolated session per request; never share conversational state between tabs.
                let session = LanguageModelSession(instructions:PromptBuilder.instructions)
                let history = PromptBuilder.clip(request.history.suffix(4).map { "\($0.role): \($0.content)" }.joined(separator:"\n"),bytes:1200)
                do {
                    answer = try await session.respond(to:"過去の会話（参考）:\n\(history)\n\n\(prompt)",options:GenerationOptions(maximumResponseTokens:900)).content
                } catch {
                    throw AIError("Apple Intelligenceで回答を生成できませんでした。選択範囲を短くするか、会話を消去して再試行してください。モデルの準備状況と言語設定も確認してください。")
                }
            } else { throw AIError("macOS 26以降が必要です。") }
        } else {
            guard activeCloudRequests < 3 else { throw AIError("複数のタブで回答中です。少し待って再試行してください。") }
            activeCloudRequests += 1;defer { activeCloudRequests -= 1 }
            let c = try SettingsStore().config(request.provider).validated()
            guard let key = try KeychainStore.read(c.account), !key.isEmpty else { throw AIError("APIキーが未登録です。AI接続設定で保存してください。") }
            answer = try await CloudClient().ask(config:c,key:key,question:prompt,history:request.history)
        }
        var result: [String:Any] = ["ok":true,"answer":answer]
        if clipped || local { result["note"] = local ? "オンデバイスAIには、ページと会話を短い抜粋にして渡しています。詳しく聞くときは該当箇所を選択してください。" : "長いページのため、本文の一部を抜粋して回答しています。" }
        return result
    }
}
