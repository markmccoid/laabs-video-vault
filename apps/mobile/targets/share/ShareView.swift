import SwiftUI

struct ShareView: View {
  @Bindable var model: ShareModel
  let cancel: () -> Void

  var body: some View {
    NavigationStack {
      content
        .background(Organic.bg)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .principal) {
            Text("Save to Video Vault").font(Organic.display(19)).foregroundStyle(Organic.text)
          }
          if !isDone {
            ToolbarItem(placement: .cancellationAction) {
              Button(isFinished ? "Close" : "Cancel", action: cancel)
                .scrollContentBackground(.hidden)
    .background(Organic.bg)
    .disabled(model.phase == .saving)
            }
          }
          if showsForm {
            ToolbarItem(placement: .confirmationAction) {
              Button(model.saveTitle) { Task { await model.save() } }
                .font(Organic.body(15, .bold))
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .tint(Organic.accent)
                .disabled(model.phase != .ready)
                .accessibilityIdentifier("share-save")
            }
          }
        }
    }
    .tint(Organic.accent)
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
      message("checkmark.circle.fill", text, nil).foregroundStyle(Organic.sageInk)
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
          .clipShape(RoundedRectangle(cornerRadius: 16))

          VStack(alignment: .leading, spacing: 4) {
            Text(model.preview?.title.nilIfEmpty ?? model.link ?? "")
              .font(Organic.body(15, .bold))
              .foregroundStyle(Organic.text)
              .lineLimit(3)
            if let channel = model.preview?.channel.nilIfEmpty {
              Text(channel).font(Organic.body(12.5)).foregroundStyle(Organic.muted)
            }
          }
        }
        .listRowBackground(Organic.surface)
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
        .font(Organic.body(14, .semibold))
        .foregroundStyle(Organic.sageInk)
        .listRowBackground(Organic.sageSoft)
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
      } header: {
        Text("Save to").font(Organic.body(12, .bold)).foregroundStyle(Organic.muted)
      }
      .font(Organic.body(15, .semibold))
      .foregroundStyle(Organic.text)
      .listRowBackground(Organic.surface)

      if case .failed(let text) = model.phase {
        Section { Text(text).font(Organic.body(14, .semibold)).foregroundStyle(Organic.accentInk) }
          .listRowBackground(Organic.surface)
      }
    }
    .scrollContentBackground(.hidden)
    .background(Organic.bg)
    .disabled(model.phase == .saving)
    .overlay { if model.phase == .saving { ProgressView() } }
  }

  private func message(_ icon: String, _ title: String, _ body: String?) -> some View {
    VStack(spacing: 12) {
      Image(systemName: icon).font(.system(size: 44)).foregroundStyle(Organic.accent)
      Text(title).font(Organic.display(20)).foregroundStyle(Organic.text).multilineTextAlignment(.center)
      if let body { Text(body).font(Organic.body(15)).foregroundStyle(Organic.muted).multilineTextAlignment(.center) }
    }
    .padding(32)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private extension String {
  var nilIfEmpty: String? { isEmpty ? nil : self }
}
