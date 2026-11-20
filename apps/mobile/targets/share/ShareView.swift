import SwiftUI

struct ShareView: View {
  @Bindable var model: ShareModel
  let cancel: () -> Void

  var body: some View {
    NavigationStack {
      content
        .navigationTitle("Save to Video Vault")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          if !isDone {
            ToolbarItem(placement: .cancellationAction) {
              Button(isFinished ? "Close" : "Cancel", action: cancel)
                .disabled(model.phase == .saving)
            }
          }
          if showsForm {
            ToolbarItem(placement: .confirmationAction) {
              Button(model.saveTitle) { Task { await model.save() } }
                .fontWeight(.semibold)
                .disabled(model.phase != .ready)
                .accessibilityIdentifier("share-save")
            }
          }
        }
    }
  }

  private var isDone: Bool {
    if case .done = model.phase { return true }
    return false
  }

  private var isFinished: Bool {
    switch model.phase {
    case .signedOut, .notYouTube, .failed: return true
    default: return false
    }
  }

  private var showsForm: Bool {
    switch model.phase {
    case .ready, .saving, .failed: return true
    default: return false
    }
  }

  @ViewBuilder private var content: some View {
    switch model.phase {
    case .loading:
      ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
    case .signedOut:
      message("person.crop.circle.badge.exclamationmark", "Sign in first",
              "Open LAABS Video Vault and sign in, then share again.")
    case .notYouTube:
      message("link.badge.plus", "Not a YouTube link", "Share a link to a YouTube video.")
    case .done(let text):
      message("checkmark.circle.fill", text, nil).foregroundStyle(.green)
    case .ready, .saving, .failed:
      form
    }
  }

  private var form: some View {
    Form {
      Section {
        HStack(alignment: .top, spacing: 12) {
          AsyncImage(url: model.preview?.thumbnail) { image in
            image.resizable().aspectRatio(16 / 9, contentMode: .fill)
          } placeholder: {
            Rectangle().fill(.quaternary).overlay(Image(systemName: "play.rectangle").foregroundStyle(.secondary))
          }
          .frame(width: 112, height: 63)
          .clipShape(RoundedRectangle(cornerRadius: 6))

          VStack(alignment: .leading, spacing: 4) {
            Text(model.preview?.title.nilIfEmpty ?? model.link ?? "")
              .font(.subheadline.weight(.semibold))
              .lineLimit(3)
            if let channel = model.preview?.channel.nilIfEmpty {
              Text(channel).font(.caption).foregroundStyle(.secondary)
            }
          }
        }
      }

      if let existing = model.existing {
        Section {
          switch existing {
          case .saved(_, let folderName, _):
            Label("Already saved · in \(folderName ?? "Inbox")", systemImage: "checkmark.circle")
          case .trashed:
            Label("In the Trash. Restoring puts it back.", systemImage: "trash")
          }
        }
        .foregroundStyle(.secondary)
      }

      Section {
        Picker("Folder", selection: $model.folderId) {
          Label("Inbox", systemImage: "tray").tag(String?.none)
          ForEach(model.folderChoices) { folder in
            Text(folder.path).tag(Optional(folder.id))
          }
        }
        .accessibilityIdentifier("share-folder")
        TextField("Note (optional)", text: $model.notes, axis: .vertical)
          .lineLimit(2...6)
          .accessibilityIdentifier("share-note")
      }

      if case .failed(let text) = model.phase {
        Section { Text(text).foregroundStyle(.red) }
      }
    }
    .disabled(model.phase == .saving)
    .overlay { if model.phase == .saving { ProgressView() } }
  }

  private func message(_ icon: String, _ title: String, _ body: String?) -> some View {
    VStack(spacing: 12) {
      Image(systemName: icon).font(.system(size: 44))
      Text(title).font(.headline).multilineTextAlignment(.center)
      if let body { Text(body).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center) }
    }
    .padding(32)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private extension String {
  var nilIfEmpty: String? { isEmpty ? nil : self }
}
