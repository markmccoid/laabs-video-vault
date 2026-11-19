import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Entry point for the share sheet (NSExtensionPrincipalClass in Info.plist).
final class ShareViewController: UIViewController {
  private lazy var model = ShareModel { [weak self] in self?.complete() }

  override func viewDidLoad() {
    super.viewDidLoad()
    let host = UIHostingController(rootView: ShareView(model: model) { [weak self] in self?.cancel() })
    addChild(host)
    host.view.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(host.view)
    NSLayoutConstraint.activate([
      host.view.topAnchor.constraint(equalTo: view.topAnchor),
      host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
    ])
    host.didMove(toParent: self)

    let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
    Task {
      let texts = await Self.sharedTexts(from: items)
      await model.start(sharedTexts: texts)
    }
  }

  /// Every URL and string shared, in order. The YouTube app shares a URL or plain text
  /// depending on version, and other apps share text containing a link.
  private static func sharedTexts(from items: [NSExtensionItem]) async -> [String] {
    var texts: [String] = []
    for item in items {
      for provider in item.attachments ?? [] {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
           let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
          texts.append(url.absoluteString)
        } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                  let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
          texts.append(text)
        }
      }
      if let text = item.attributedContentText?.string { texts.append(text) }
    }
    return texts
  }

  private func complete() {
    extensionContext?.completeRequest(returningItems: nil)
  }

  private func cancel() {
    extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError))
  }
}
