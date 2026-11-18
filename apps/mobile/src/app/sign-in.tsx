import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { authErrorMessage } from "@/lib/authErrors";
import { useTheme } from "@/lib/theme";

type Flow = "signIn" | "signUp";

export default function SignIn() {
  const theme = useTheme();
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<Flow>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn("password", { email: email.trim().toLowerCase(), password, flow });
    } catch (err) {
      setError(authErrorMessage(err, flow));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: theme.bg }]}
    >
      <View style={styles.form}>
        <Text style={[styles.title, { color: theme.text }]}>LAABS Video Vault</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          {flow === "signIn" ? "Sign in to your library" : "Create your library"}
        </Text>

        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={inputStyle}
          placeholder="Password"
          placeholderTextColor={theme.muted}
          secureTextEntry
          autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          textContentType={flow === "signIn" ? "password" : "newPassword"}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />

        {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

        <Pressable
          style={[styles.button, { backgroundColor: theme.accent, opacity: busy ? 0.6 : 1 }]}
          disabled={busy || !email || !password}
          onPress={submit}
        >
          {busy ? (
            <ActivityIndicator color={theme.accentText} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.accentText }]}>
              {flow === "signIn" ? "Sign in" : "Create account"}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setFlow(flow === "signIn" ? "signUp" : "signIn")} hitSlop={8}>
          <Text style={[styles.switch, { color: theme.accent }]}>
            {flow === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center" },
  form: { paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 30, fontWeight: "800" },
  subtitle: { fontSize: 16, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  error: { fontSize: 14 },
  button: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  switch: { textAlign: "center", marginTop: 8, fontSize: 15 },
});
