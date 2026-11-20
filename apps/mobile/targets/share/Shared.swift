import Foundation
import Security

/// Everything the app and the Share Extension exchange. The app writes these from
/// `src/lib/shareBridge.ts`; keep the names in sync with it.
enum Shared {
  static let appGroup = "group.com.markmccoid.laabs-video-vault"

  // App Group UserDefaults keys.
  static let siteUrlKey = "convexSiteUrl"
  static let foldersKey = "folders"
  static let queueKey = "shareQueue"

  // The share token is a Keychain item written by expo-secure-store with
  // `keychainService: "lvvShare"` and `accessGroup: appGroup`. expo-secure-store
  // appends ":no-auth" to the service and stores the key as UTF-8 data.
  private static let keychainService = "lvvShare:no-auth"
  private static let tokenKey = "shareToken"

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static func shareToken() -> String? {
    let key = Data(tokenKey.utf8)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: keychainService,
      kSecAttrGeneric as String: key,
      kSecAttrAccount as String: key,
      kSecAttrAccessGroup as String: appGroup,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data,
          let token = String(data: data, encoding: .utf8),
          !token.isEmpty
    else { return nil }
    return token
  }

  static func siteUrl() -> URL? {
    guard let raw = defaults?.string(forKey: siteUrlKey) else { return nil }
    return URL(string: raw)
  }

  /// The folder tree, flattened in display order (written by the app whenever folders change).
  static func folders() -> [SharedFolder] {
    guard let raw = defaults?.string(forKey: foldersKey), let data = raw.data(using: .utf8) else { return [] }
    let flat = (try? JSONDecoder().decode([SharedFolder].self, from: data)) ?? []
    // The list is in tree order, so each folder's ancestors come right before it.
    var ancestors: [String] = []
    return flat.map { folder in
      ancestors = Array(ancestors.prefix(folder.depth)) + [folder.name]
      var named = folder
      named.path = ancestors.joined(separator: " › ")
      return named
    }
  }

  /// Add a save that couldn't reach the server. The app sends these the next time it's in the foreground.
  static func enqueue(_ item: QueuedShare) {
    var queue: [QueuedShare] = []
    if let raw = defaults?.string(forKey: queueKey), let data = raw.data(using: .utf8) {
      queue = (try? JSONDecoder().decode([QueuedShare].self, from: data)) ?? []
    }
    queue.removeAll { $0.url == item.url }
    queue.append(item)
    if let data = try? JSONEncoder().encode(queue), let raw = String(data: data, encoding: .utf8) {
      defaults?.set(raw, forKey: queueKey)
    }
  }
}

struct SharedFolder: Decodable, Hashable, Identifiable {
  let id: String
  let name: String
  let depth: Int
  /// "AI › Programming". Filled in by `Shared.folders()`.
  var path = ""

  private enum CodingKeys: String, CodingKey { case id, name, depth }

  init(id: String, name: String, depth: Int, path: String) {
    self.id = id; self.name = name; self.depth = depth; self.path = path
  }
}

struct QueuedShare: Codable {
  let url: String
  let folderId: String?
  let notes: String?
  let update: Bool?
  let sharedAt: Double
}
