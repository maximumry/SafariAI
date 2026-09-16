import Foundation
import Security

struct KeychainStore {
    static let service = "com.komorebi.SafariAI.credentials"
    static func query(_ account: String) -> [String: Any] {
        [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:account]
    }
    static func read(_ account: String) throws -> String? {
        var q = query(account);q[kSecReturnData as String] = true;q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data, let value = String(data:data,encoding:.utf8) else { throw AIError("キーチェーンを読み取れませんでした（\(status)）。Macのロック状態とアプリの署名を確認してください。") }
        return value
    }
    static func write(_ key: String, account: String) throws {
        guard key.count <= 4096, !key.contains(where: \.isNewline) else { throw AIError("APIキーの形式を確認してください。") }
        let q = query(account), data = Data(key.utf8)
        let status = SecItemUpdate(q as CFDictionary,[kSecValueData as String:data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = q;item[kSecValueData as String] = data;item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            let add = SecItemAdd(item as CFDictionary,nil)
            guard add == errSecSuccess else { throw AIError("APIキーを保存できませんでした（\(add)）。アプリの署名を確認してください。") }
        } else if status != errSecSuccess { throw AIError("APIキーを更新できませんでした（\(status)）。") }
    }
    static func delete(_ account: String) throws {
        let status = SecItemDelete(query(account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw AIError("APIキーを削除できませんでした（\(status)）。") }
    }
}
struct SettingsStore {
    // Stored in the native extension container. The browser never receives API keys.
    private let defaults = UserDefaults.standard
    func config(_ provider: Provider) -> ProviderConfig {
        if let data = defaults.data(forKey:"provider.\(provider.rawValue)"), let config = try? JSONDecoder().decode(ProviderConfig.self,from:data) { return config }
        return ProviderConfig(provider:provider,model:"",endpoint:provider.endpoint)
    }
    var defaultProvider: Provider { Provider(rawValue:defaults.string(forKey:"defaultProvider") ?? "") ?? .local }
    func save(_ message: [String:Any]) throws {
        guard let dict = message["config"] as? [String:Any], let p = Provider(rawValue:dict["provider"] as? String ?? "") else { throw AIError("接続先が正しくありません。") }
        if message["deleteKey"] as? Bool == true { try KeychainStore.delete(config(p).account); return }
        let c = try ProviderConfig(provider:p,model:dict["model"] as? String ?? "",endpoint:dict["endpoint"] as? String ?? "").validated()
        if p != .local, let key = message["key"] as? String, !key.isEmpty { try KeychainStore.write(key,account:c.account) }
        let old = config(p)
        defaults.set(try JSONEncoder().encode(c),forKey:"provider.\(p.rawValue)")
        if dict["makeDefault"] as? Bool == true { defaults.set(p.rawValue,forKey:"defaultProvider") }
        if p == .custom && old.account != c.account { try KeychainStore.delete(old.account) }
    }
    func publicConfigs() -> [String:Any] {
        var result: [String:Any] = [:]
        for p in Provider.allCases {
            let c = config(p)
            result[p.rawValue] = ["model":c.model,"endpoint":c.endpoint,"hasKey":((try? KeychainStore.read(c.account)) ?? nil) != nil]
        }
        return result
    }
}
