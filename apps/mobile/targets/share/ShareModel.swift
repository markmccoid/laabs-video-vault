import Foundation
import Observation

/// State for the share card. Nothing is saved until the user taps Save.
@MainActor
@Observable
final class ShareModel {
  enum Phase: Equatable {
    case loading
    /// No share token on this device (never signed in, or signed out). Saves nothing.
    case signedOut
    case notYouTube
    case ready
    case saving
    /// Saved (or queued). The card closes on its own shortly after.
    case done(String)
    case failed(String)
  }

  var phase: Phase = .loading
  var link: String?
  var preview: VideoPreview?
  /// Set when the lookup found the video already in the library.
  var existing: ShareAPI.Existing?
  let folders: [SharedFolder] = Shared.folders()
  /// nil = Inbox.
  var folderId: String?
  var notes = ""

  private var api: ShareAPI?
  private let finish: () -> Void

  init(finish: @escaping () -> Void) {
    self.finish = finish
  }

  var saveTitle: String {
    switch existing {
    case .saved: return "Update"
    case .trashed: return "Restore"
    case nil: return "Save"
    }
  }

  /// Folder choices, plus the video's current folder if it's missing from the device's list.
  var folderChoices: [SharedFolder] {
    guard let current = existing?.folderId, !folders.contains(where: { $0.id == current }) else { return folders }
    return folders + [SharedFolder(id: current, name: existing?.folderName ?? "Current folder", depth: 0,
                                  path: existing?.folderName ?? "Current folder")]
  }

  func start(sharedTexts: [String]) async {
    guard let link = sharedTexts.lazy.compactMap(firstYouTubeLink(in:)).first else {
      phase = .notYouTube
      return
    }
    self.link = link
    guard let token = Shared.shareToken(), let base = Shared.siteUrl() else {
      phase = .signedOut
      return
    }
    let api = ShareAPI(base: base, token: token)
    self.api = api

    async let preview = VideoPreview.fetch(for: link)
    do throws(ShareAPI.Failure) {
      existing = try await api.lookup(url: link)
      folderId = existing?.folderId
      notes = existing?.notes ?? ""
      phase = .ready
    } catch {
      switch error {
      case .unauthorized: phase = .signedOut
      case .invalid: phase = .notYouTube
      // Offline: still let the user save; the server sorts out duplicates later.
      case .unreachable: phase = .ready
      }
    }
    self.preview = await preview
  }

  func save() async {
    guard let api, let link, phase == .ready else { return }
    phase = .saving
    let note = notes.trimmingCharacters(in: .whitespacesAndNewlines)
    let update = existing != nil
    do throws(ShareAPI.Failure) {
      let result = try await api.save(url: link, folderId: folderId, notes: note, update: update)
      phase = .done(message(for: result))
      closeSoon(after: 0.9)
    } catch {
      switch error {
      case .unauthorized: phase = .signedOut
      case .invalid(let message): phase = .failed(message)
      case .unreachable: queue(link: link, note: note, update: update)
      }
    }
  }

  private func queue(link: String, note: String, update: Bool) {
    Shared.enqueue(QueuedShare(
      url: link, folderId: folderId, notes: note, update: update ? true : nil,
      sharedAt: Date().timeIntervalSince1970 * 1000
    ))
    phase = .done("Saved. It'll be added next time you open Video Vault.")
    closeSoon(after: 1.8)
  }

  private func folderName(_ id: String?) -> String {
    guard let id else { return "Inbox" }
    return folderChoices.first { $0.id == id }?.name ?? "Inbox"
  }

  private func message(for result: ShareAPI.SaveResult) -> String {
    let place = folderName(result.folderId)
    switch result.status {
    case "restored": return "Restored to \(place)"
    case "updated": return "Updated"
    case "duplicate": return "Already saved in \(place)"
    default: return "Saved to \(place)"
    }
  }

  private func closeSoon(after seconds: Double) {
    Task {
      try? await Task.sleep(for: .seconds(seconds))
      finish()
    }
  }
}
