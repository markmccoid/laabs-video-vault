import { watchUrl } from "@lvv/core";
import { Image } from "expo-image";
import { type Ref, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

/**
 * WebView's extra-props type parameter defaults to `undefined`, and
 * `WebViewProps & undefined` is `never` under TS 6, so pin it to `{}`.
 */
type NoExtraProps = Record<never, never>;

/**
 * YouTube requires embeds inside a WebView to identify the app with an
 * https Referer (otherwise playback fails with error 152/153). The page is
 * loaded from this base URL, so it is both the Referer and the IFrame API origin.
 */
const APP_ORIGIN = "https://com.markmccoid.laabs-video-vault";

export type YouTubePlayerHandle = {
  /** Seek to `seconds` and play. Starts the player first if it isn't running. */
  seekTo: (seconds: number) => void;
};

type Props = {
  youtubeId: string;
  thumbnail: string;
  ref?: Ref<YouTubePlayerHandle>;
};

type PlayerMessage = { type: "ready" } | { type: "error"; code: number | "load" };

/** IFrame API error codes: https://developers.google.com/youtube/iframe_api_reference#onError */
function errorText(code: number | "load"): string {
  switch (code) {
    case 100:
      return "This video was removed or made private.";
    case 101:
    case 150:
      return "The owner doesn't allow this video to play outside YouTube.";
    case "load":
      return "Couldn't load the YouTube player. Check your connection.";
    default:
      return "This video can't play here.";
  }
}

function playerHtml(youtubeId: string, startSeconds: number): string {
  const vars = {
    playsinline: 1,
    autoplay: 1,
    rel: 0,
    fs: 1,
    start: Math.floor(startSeconds),
    origin: APP_ORIGIN,
  };
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#player{position:absolute;inset:0;width:100%;height:100%}</style>
</head><body>
<div id="player"></div>
<script>
  function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
  var player;
  function onYouTubeIframeAPIReady(){
    player = new YT.Player("player", {
      videoId: ${JSON.stringify(youtubeId)},
      playerVars: ${JSON.stringify(vars)},
      events: {
        onReady: function(e){ send({type:"ready"}); e.target.playVideo(); },
        onError: function(e){ send({type:"error", code:e.data}); }
      }
    });
  }
</script>
<script src="https://www.youtube.com/iframe_api" onerror="send({type:'error',code:'load'})"></script>
</body></html>`;
}

/**
 * Embedded YouTube player. Shows the thumbnail until tapped (so the detail
 * screen doesn't spin up a WebView for every visit), then plays inline.
 * Falls back to an "Open in YouTube" card when the video can't be embedded.
 */
export function YouTubePlayer({ youtubeId, thumbnail, ref }: Props) {
  const webview = useRef<WebView<NoExtraProps>>(null);
  // `start` is fixed when the WebView mounts; later seeks go through injectJavaScript.
  const [start, setStart] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<number | "load" | null>(null);
  const [resumeAt, setResumeAt] = useState(0);

  const html = useMemo(() => (start === null ? null : playerHtml(youtubeId, start)), [youtubeId, start]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: (seconds) => {
        setResumeAt(seconds);
        if (start === null || error !== null) {
          setError(null);
          setReady(false);
          setStart(seconds);
          return;
        }
        webview.current?.injectJavaScript(
          `player && player.seekTo(${Math.floor(seconds)}, true); player && player.playVideo(); true;`,
        );
      },
    }),
    [start, error],
  );

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let msg: PlayerMessage;
    try {
      msg = JSON.parse(e.nativeEvent.data) as PlayerMessage;
    } catch {
      return;
    }
    if (msg.type === "ready") setReady(true);
    if (msg.type === "error") setError(msg.code);
  }, []);

  const openInYouTube = () => void Linking.openURL(watchUrl(youtubeId, resumeAt));

  if (error !== null) {
    return (
      <View style={styles.frame}>
        <Image source={thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={12} />
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>{errorText(error)}</Text>
          <Pressable style={styles.pill} onPress={openInYouTube}>
            <Text style={styles.pillText}>▶ Open in YouTube</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (html === null) {
    return (
      <Pressable
        style={styles.frame}
        onPress={() => setStart(0)}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        <Image source={thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.playButton}>
          <Text style={styles.playGlyph}>▶</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.frame}>
      <WebView<NoExtraProps>
        ref={webview}
        source={{ html, baseUrl: APP_ORIGIN }}
        style={styles.webview}
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        // Off by default in react-native-webview. Chromecast isn't possible in an iOS
        // web embed; "Open in YouTube" covers that.
        allowsAirPlayForMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        onMessage={onMessage}
        onError={() => setError("load")}
        onShouldStartLoadWithRequest={(req) => {
          // The player iframe and its internals load freely; top-level navigation
          // (tapping the YouTube logo or title) goes to the real YouTube instead.
          if (req.isTopFrame === false) return true;
          if (req.url.startsWith(APP_ORIGIN) || req.url === "about:blank") return true;
          void Linking.openURL(req.url);
          return false;
        }}
      />
      {!ready && (
        <View style={[StyleSheet.absoluteFill, styles.loading]} pointerEvents="none">
          <Image source={thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" />
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", overflow: "hidden" },
  webview: { flex: 1, backgroundColor: "#000" },
  loading: { alignItems: "center", justifyContent: "center" },
  playButton: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    marginTop: -32,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000B",
    alignItems: "center",
    justifyContent: "center",
  },
  playGlyph: { color: "#fff", fontSize: 26, marginLeft: 4 },
  fallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0009",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  fallbackText: { color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center" },
  pill: { backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  pillText: { color: "#000", fontWeight: "700" },
});
