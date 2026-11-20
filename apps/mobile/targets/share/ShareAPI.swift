import Foundation

/// Client for the backend's `/share` endpoints (packages/backend/convex/share.ts).
struct ShareAPI {
  let base: URL
  let token: String

  enum Failure: Error {
    /// Token unknown or revoked: treat as signed out, don't queue.
    case unauthorized
    /// The server says the input can't be saved (e.g. not a YouTube link).
    case invalid(String)
    /// Offline, timed out, or a server error: worth queueing.
    case unreachable
  }

  enum Existing {
    case saved(folderId: String?, folderName: String?, notes: String)
    case trashed(folderId: String?, folderName: String?, notes: String)

    var folderId: String? {
      switch self { case .saved(let id, _, _), .trashed(let id, _, _): return id }
    }
    var folderName: String? {
      switch self { case .saved(_, let name, _), .trashed(_, let name, _): return name }
    }
    var notes: String {
      switch self { case .saved(_, _, let notes), .trashed(_, _, let notes): return notes }
    }
  }

  struct SaveResult {
    /// added | restored | duplicate | updated
    let status: String
    let folderId: String?
  }

  /// Whether the video is already in the library. nil = not saved yet.
  func lookup(url: String) async throws(Failure) -> Existing? {
    let body = try await post("share/lookup", ["url": url])
    let folderId = body["folderId"] as? String
    let folderName = body["folderName"] as? String
    let notes = body["notes"] as? String ?? ""
    switch body["status"] as? String {
    case "saved": return .saved(folderId: folderId, folderName: folderName, notes: notes)
    case "trashed": return .trashed(folderId: folderId, folderName: folderName, notes: notes)
    default: return nil
    }
  }

  func save(url: String, folderId: String?, notes: String, update: Bool) async throws(Failure) -> SaveResult {
    var payload: [String: Any] = ["url": url, "notes": notes]
    if let folderId { payload["folderId"] = folderId }
    if update { payload["update"] = true }
    let body = try await post("share", payload)
    return SaveResult(status: body["status"] as? String ?? "added", folderId: body["folderId"] as? String)
  }

  private func post(_ path: String, _ payload: [String: Any]) async throws(Failure) -> [String: Any] {
    var request = URLRequest(url: base.appending(path: path), timeoutInterval: 10)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw .unreachable
    }
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    switch status {
    case 200: return body
    case 401: throw .unauthorized
    case 400: throw .invalid(body["message"] as? String ?? "That doesn't look like a YouTube link.")
    default: throw .unreachable
    }
  }
}

/// Title, channel, and thumbnail for the card. Display only, never stored.
struct VideoPreview {
  let title: String
  let channel: String
  let thumbnail: URL?

  static func fetch(for link: String) async -> VideoPreview? {
    var components = URLComponents(string: "https://www.youtube.com/oembed")!
    components.queryItems = [URLQueryItem(name: "url", value: link), URLQueryItem(name: "format", value: "json")]
    guard let url = components.url,
          let (data, response) = try? await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 6)),
          (response as? HTTPURLResponse)?.statusCode == 200,
          let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    else { return nil }
    return VideoPreview(
      title: json["title"] as? String ?? "",
      channel: json["author_name"] as? String ?? "",
      thumbnail: (json["thumbnail_url"] as? String).flatMap(URL.init(string:))
    )
  }
}

/// The first YouTube link in shared text. The server parses it properly; this only
/// decides whether there's anything worth showing.
func firstYouTubeLink(in text: String) -> String? {
  let pattern = #"(?:https?://)?(?:[a-z0-9-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/[^\s<>"']+"#
  guard let range = text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) else { return nil }
  let link = String(text[range])
  return link.lowercased().hasPrefix("http") ? link : "https://\(link)"
}
