import Foundation

final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        // Never forward credentials to redirect targets, including custom provider redirects.
        completionHandler(nil)
    }
}
struct CloudClient {
    static func buildRequest(config: ProviderConfig, key: String, question: String, history: [ChatTurn]) throws -> URLRequest {
        let c = try config.validated()
        let path = c.provider == .openai ? "/responses" : c.provider == .anthropic ? "/messages" : "/chat/completions"
        guard let url = URL(string:c.endpoint + path) else { throw AIError("接続先URLが正しくありません。") }
        var request = URLRequest(url:url,timeoutInterval:90)
        request.httpMethod = "POST";request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        let turns = history.map { ["role":$0.role,"content":$0.content] } + [["role":"user","content":question]]
        var body: [String:Any] = ["model":c.model]
        if c.provider == .openai {
            request.setValue("Bearer \(key)",forHTTPHeaderField:"Authorization")
            body["instructions"] = PromptBuilder.instructions;body["input"] = turns;body["store"] = false;body["max_output_tokens"] = 3000
        } else if c.provider == .anthropic {
            request.setValue(key,forHTTPHeaderField:"x-api-key");request.setValue("2023-06-01",forHTTPHeaderField:"anthropic-version")
            body["system"] = PromptBuilder.instructions;body["messages"] = turns;body["max_tokens"] = 2200
        } else {
            request.setValue("Bearer \(key)",forHTTPHeaderField:"Authorization")
            body["messages"] = [["role":"system","content":PromptBuilder.instructions]] + turns
            body["max_tokens"] = 2200
        }
        request.httpBody = try JSONSerialization.data(withJSONObject:body)
        return request
    }
    static func parse(_ data: Data, status: Int, provider: Provider) throws -> String {
        guard (200..<300).contains(status) else {
            switch status {
            case 401,403: throw AIError("認証できませんでした（HTTP \(status)）。APIキーとモデルの利用権限を確認してください。")
            case 404: throw AIError("モデルまたはAPIが見つかりません（HTTP 404）。モデルIDとベースURLを確認してください。")
            case 429: throw AIError("利用上限または混雑により応答できません（HTTP 429）。残高・利用制限を確認し、しばらくして再試行してください。")
            case 400,422: throw AIError("このモデルでリクエストを処理できません（HTTP \(status)）。モデルID・API互換性を確認するか、送る文章を短くしてください。")
            case 300..<400: throw AIError("接続先がリダイレクトを返しました。APIの正確なHTTPS URLを設定してください。")
            default: throw AIError("AIサービスが応答できませんでした（HTTP \(status)）。時間をおいて再試行してください。")
            }
        }
        guard let json = try? JSONSerialization.jsonObject(with:data) as? [String:Any] else { throw AIError("AIサービスから不正な応答を受信しました。") }
        var answer = ""
        if provider == .openai {
            answer = (json["output"] as? [[String:Any]] ?? []).flatMap { $0["content"] as? [[String:Any]] ?? [] }.compactMap { part -> String? in
                if part["type"] as? String == "output_text" { return part["text"] as? String }
                if part["type"] as? String == "refusal" { return part["refusal"] as? String }
                return nil
            }.joined(separator:"\n")
            if json["status"] as? String == "incomplete", !answer.isEmpty { answer += "\n\n※ 出力上限により途中で終了しました。短く分けて質問してください。" }
        } else if provider == .anthropic {
            answer = (json["content"] as? [[String:Any]] ?? []).filter { $0["type"] as? String == "text" }.compactMap { $0["text"] as? String }.joined(separator:"\n")
            if json["stop_reason"] as? String == "max_tokens", !answer.isEmpty { answer += "\n\n※ 出力上限により途中で終了しました。" }
        } else {
            let choice = (json["choices"] as? [[String:Any]])?.first
            answer = (choice?["message"] as? [String:Any])?["content"] as? String ?? ""
            if choice?["finish_reason"] as? String == "length", !answer.isEmpty { answer += "\n\n※ 出力上限により途中で終了しました。" }
        }
        guard !answer.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty else { throw AIError("テキストの回答がありませんでした。別のモデルを選ぶか、質問を短くして再試行してください。") }
        return String(answer.prefix(30000))
    }
    func ask(config: ProviderConfig, key: String, question: String, history: [ChatTurn]) async throws -> String {
        let request = try Self.buildRequest(config:config,key:key,question:question,history:history)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 90;configuration.timeoutIntervalForResource = 100
        configuration.httpCookieStorage = nil;configuration.urlCache = nil;configuration.httpShouldSetCookies = false
        let session = URLSession(configuration:configuration,delegate:NoRedirectDelegate(),delegateQueue:nil)
        defer { session.invalidateAndCancel() }
        do {
            let (data,response) = try await session.data(for:request)
            guard data.count < 2_000_000, let http = response as? HTTPURLResponse else { throw AIError("AIサービスの応答が大きすぎるか、不正です。") }
            return try Self.parse(data,status:http.statusCode,provider:config.provider)
        } catch let error as AIError { throw error }
        catch let error as URLError {
            if error.code == .timedOut { throw AIError("接続がタイムアウトしました。時間をおいて、質問を短くして再試行してください。") }
            throw AIError("AIサービスへ接続できません。インターネット接続とAPIのURLを確認してください。")
        }
    }
}
