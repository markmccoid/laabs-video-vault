import SwiftUI
import UIKit

/// Organic design tokens (design_handoff_shelf/README.md), matching apps/mobile/src/lib/theme.ts.
enum Organic {
  static let bg = dynamic(light: 0xF5EAD8, dark: 0x1D1A16)
  static let surface = dynamic(light: 0xEBDDC5, dark: 0x2B2620)
  static let text = dynamic(light: 0x201E1D, dark: 0xF5EAD8)
  static let muted = dynamic(light: 0x645C50, dark: 0xC0B6A5)
  static let accent = dynamic(light: 0xC67139, dark: 0xD67F48)
  static let accentInk = dynamic(light: 0x8C491A, dark: 0xF6A06B)
  static let accentText = dynamic(light: 0xF5EAD8, dark: 0x1D1A16)
  static let sageSoft = dynamic(light: 0xF0FAE1, dark: 0x242A1B)
  static let sageInk = dynamic(light: 0x56633F, dark: 0xCCDBB2)

  /// Caprasimo for headings, Figtree for body. Falls back to the system font if a file is missing.
  static func display(_ size: CGFloat) -> Font { .custom("Caprasimo-Regular", size: size) }
  static func body(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
    switch weight {
    case .bold, .heavy, .black: return .custom("Figtree-Bold", size: size)
    case .semibold, .medium: return .custom("Figtree-SemiBold", size: size)
    default: return .custom("Figtree-Regular", size: size)
    }
  }

  private static func dynamic(light: UInt32, dark: UInt32) -> Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
  }
}

private extension UIColor {
  convenience init(hex: UInt32) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1
    )
  }
}
