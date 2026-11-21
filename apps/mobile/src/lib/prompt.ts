import { Alert } from "react-native";
import { errorMessage } from "@/lib/errors";

/** iOS text prompt as a promise. Resolves null on Cancel. */
export function promptText(title: string, opts: { message?: string; initial?: string; action?: string } = {}) {
  return new Promise<string | null>((resolve) => {
    Alert.prompt(
      title,
      opts.message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        { text: opts.action ?? "Save", isPreferred: true, onPress: (value?: string) => resolve(value ?? "") },
      ],
      "plain-text",
      opts.initial,
    );
  });
}

/** Ask for confirmation of a destructive action. */
export function confirmDestructive(title: string, message: string, action: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

/** Ask for confirmation of a harmless action. */
export function confirmAction(title: string, message: string, action: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, isPreferred: true, onPress: () => resolve(true) },
    ]);
  });
}

/** Run a mutation and show any failure in an alert. Returns false if it failed. */
export async function attempt(title: string, run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (err) {
    Alert.alert(title, errorMessage(err));
    return false;
  }
}
