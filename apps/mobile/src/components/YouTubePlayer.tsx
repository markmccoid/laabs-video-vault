import { watchUrl } from "@lvv/core";
import { Image } from "expo-image";
import { type ReactNode, type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewInstance } from "react-native";
import { SymbolView } from "expo-symbols";
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
  /**
   * Seek to `seconds`. Starts the player first if it isn't running. Plays
   * afterwards unless `play` is false (a paused video then stays paused).
   */
  seekTo: (seconds: number, opts?: { play?: boolean }) => void;
  /** Last reported playback position in seconds (0 before playback starts). */
  getCurrentTime: () => number;
  /** Play, starting the player first if it isn't running. */
  play: () => void;
  pause: () => void;
  /** Fill the screen, turned sideways since the app is portrait-only. Playback carries on. */
  enterFullscreen: () => void;
  exitFullscreen: () => void;
};

type Props = {
  youtubeId: string;
  thumbnail: string;
  ref?: Ref<YouTubePlayerHandle>;
  /** Called about once a second while the player runs. */
  onTimeUpdate?: (seconds: number, duration: number) => void;
  /** Show YouTube's own controls over the video. Fixed when the player starts. */
  controls?: boolean;
  /** Playback speed, applied when the player is ready and whenever it changes. */
  playbackRate?: number;
  /** Captions on or off, applied whenever playback starts and whenever it changes. */
  captions?: boolean;
  /** Called when playback starts or stops (buffering counts as playing). */
  onPlayingChange?: (playing: boolean) => void;
  /** Where play starts if nothing seeks first (Watch Progress). Read when the player mounts. */
  initialPosition?: number;
  /** Start the player on mount instead of showing the thumbnail (the row menu's Play). */
  autoPlay?: boolean;
  /** Called when full screen starts or ends. */
  onFullscreenChange?: (on: boolean) => void;
  /** Our controls, shown over the video in full screen (tap to show or hide) when YouTube's own are off. */
  fullscreenControls?: ReactNode;
};

type PlayerMessage =
  | { type: "ready" }
  | { type: "error"; code: number | "load" }
  | { type: "time"; t: number; d: number }
  | { type: "state"; playing: boolean };

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

function playerHtml(youtubeId: string, startSeconds: number, controls: boolean, rate: number, captions: boolean): string {
  const vars = {
    playsinline: 1,
    autoplay: 1,
    rel: 0,
    fs: 1,
    controls: controls ? 1 : 0,
    cc_load_policy: captions ? 1 : 0,
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
  // Captions go through the player's (undocumented) captions module: unloading
  // it hides them, loading it shows the default track. The player reloads the
  // module when playback starts and after every seek, so this runs each time
  // it starts playing (and again a moment later, in case the module loads late).
  var captionsOn = ${captions};
  var reapply;
  function applyCaptions(){
    try { captionsOn ? player.loadModule("captions") : player.unloadModule("captions"); } catch(_){}
  }
  function setCaptions(on){ captionsOn = on; applyCaptions(); }
  function onYouTubeIframeAPIReady(){
    player = new YT.Player("player", {
      videoId: ${JSON.stringify(youtubeId)},
      playerVars: ${JSON.stringify(vars)},
      events: {
        onReady: function(e){
          send({type:"ready"}); e.target.setPlaybackRate(${rate}); e.target.playVideo();
          setInterval(function(){
            try { send({type:"time", t:player.getCurrentTime()||0, d:player.getDuration()||0}); } catch(_){}
          }, 1000);
        },
        onStateChange: function(e){
          send({type:"state", playing: e.data === 1 || e.data === 3});
          if (e.data === 1) { applyCaptions(); clearTimeout(reapply); reapply = setTimeout(applyCaptions, 1000); }
        },
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
 * screen doesn't spin up a WebView for every visit), then plays inline. If the
 * web process dies, it drops back to the thumbnail at the last position.
 * Falls back to an "Open in YouTube" card when the video can't be embedded.
 */
export function YouTubePlayer({
  youtubeId,
  thumbnail,
  ref,
  onTimeUpdate,
  controls = true,
  playbackRate = 1,
  captions = false,
  onPlayingChange,
  initialPosition = 0,
  autoPlay = false,
  onFullscreenChange,
  fullscreenControls,
}: Props) {
  const time = useRef(initialPosition);
  const webview = useRef<WebView<NoExtraProps>>(null);
  // `start` is fixed when the WebView mounts; later seeks go through injectJavaScript.
  const [start, setStart] = useState<number | null>(autoPlay ? initialPosition : null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<number | "load" | null>(null);
  const [resumeAt, setResumeAt] = useState(initialPosition);
  // Bumped when the web process dies, so the next start mounts a fresh WebView.
  const [instance, setInstance] = useState(0);
  // Full screen keeps the same WebView (moving it to a Modal would reload the
  // video) and only restyles it: it breaks out of the inline frame to cover the
  // window, measured from where the frame sits on screen. The screen must not
  // scroll meanwhile (onFullscreenChange).
  const [fullscreen, setFullscreen] = useState<{ x: number; y: number } | null>(null);
  const [showUi, setShowUi] = useState(true);
  const frameRef = useRef<ViewInstance>(null);
  const win = useWindowDimensions();
  const fullscreenCb = useRef(onFullscreenChange);
  fullscreenCb.current = onFullscreenChange;

  // The rate at mount goes into the page; later changes go through injectJavaScript.
  const rateRef = useRef(playbackRate);
  rateRef.current = playbackRate;
  // Same for captions: toggling them must not rebuild the page.
  const captionsRef = useRef(captions);
  captionsRef.current = captions;
  const html = useMemo(
    () => (start === null ? null : playerHtml(youtubeId, start, controls, rateRef.current, captionsRef.current)),
    [youtubeId, start, controls],
  );

  useEffect(() => {
    if (ready) webview.current?.injectJavaScript(`player && player.setPlaybackRate(${playbackRate}); true;`);
  }, [ready, playbackRate]);

  useEffect(() => {
    if (ready) webview.current?.injectJavaScript(`setCaptions(${captions}); true;`);
  }, [ready, captions]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: (seconds, opts) => {
        setResumeAt(seconds);
        if (start === null || error !== null) {
          setError(null);
          setReady(false);
          setStart(seconds);
          return;
        }
        webview.current?.injectJavaScript(
          `player && player.seekTo(${Math.floor(seconds)}, true);${opts?.play === false ? "" : " player && player.playVideo();"} true;`,
        );
      },
      getCurrentTime: () => time.current,
      play: () => {
        if (start === null || error !== null) {
          setError(null);
          setReady(false);
          setStart(time.current);
          return;
        }
        webview.current?.injectJavaScript("player && player.playVideo(); true;");
      },
      pause: () => webview.current?.injectJavaScript("player && player.pauseVideo(); true;"),
      enterFullscreen: () => {
        if (start === null || error !== null) {
          setError(null);
          setReady(false);
          setStart(time.current);
        }
        frameRef.current?.measureInWindow((x, y) => {
          setShowUi(true);
          setFullscreen({ x, y });
          fullscreenCb.current?.(true);
        });
      },
      exitFullscreen: () => exitFullscreen(),
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
    if (msg.type === "error") {
      setError(msg.code);
      onPlayingChange?.(false);
    }
    if (msg.type === "state") onPlayingChange?.(msg.playing);
    if (msg.type === "time") {
      time.current = msg.t;
      onTimeUpdate?.(msg.t, msg.d);
    }
  }, [onTimeUpdate, onPlayingChange]);

  /**
   * iOS (or Android) can kill the WebView's web process, usually while the app
   * sits in the background. The WebView then shows black and ignores scripts,
   * so go back to the thumbnail; play resumes from the last position.
   */
  const onProcessGone = useCallback(() => {
    setFullscreen(null);
    fullscreenCb.current?.(false);
    setReady(false);
    setStart(null);
    setResumeAt(time.current);
    setInstance((i) => i + 1);
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  function exitFullscreen() {
    setFullscreen(null);
    fullscreenCb.current?.(false);
  }

  // Our controls fade after a few seconds; a tap brings them back.
  useEffect(() => {
    if (!fullscreen || !showUi) return;
    const timer = setTimeout(() => setShowUi(false), 4000);
    return () => clearTimeout(timer);
  }, [fullscreen, showUi]);

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
        ref={frameRef}
        style={styles.frame}
        onPress={() => setStart(time.current)}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        <Image source={thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.playButton}>
          <SymbolView name="play.fill" size={24} tintColor="#2e2b25" />
        </View>
      </Pressable>
    );
  }

  const content = (
    <>
      <WebView<NoExtraProps>
        key={instance}
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
        onContentProcessDidTerminate={onProcessGone}
        onRenderProcessGone={onProcessGone}
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
    </>
  );

  // The same three Views in both modes, so the WebView is never remounted.
  const fs = fullscreen;
  return (
    <View ref={frameRef} style={[styles.frame, fs && styles.frameOpen]}>
      <View style={fs ? [styles.backdrop, { left: -fs.x, top: -fs.y, width: win.width, height: win.height }] : StyleSheet.absoluteFill}>
        <View
          style={
            fs
              ? {
                  // A landscape box turned a quarter turn, since the app is portrait-only.
                  position: "absolute",
                  width: win.height,
                  height: win.width,
                  left: (win.width - win.height) / 2,
                  top: (win.height - win.width) / 2,
                  transform: [{ rotate: "90deg" }],
                }
              : styles.inline
          }
        >
          {content}
          {fs && (
            <>
              {/* YouTube's own controls take taps themselves; otherwise a tap toggles ours. */}
              {!controls && <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowUi((v) => !v)} accessibilityLabel="Show controls" />}
              {(showUi || controls) && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  {!controls && showUi && (
                    <View style={styles.controlsBar} pointerEvents="box-none">
                      {fullscreenControls}
                    </View>
                  )}
                  <Pressable onPress={exitFullscreen} accessibilityRole="button" accessibilityLabel="Exit full screen" hitSlop={8} style={styles.exit}>
                    <SymbolView name="arrow.down.right.and.arrow.up.left" size={16} tintColor="#fff" />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Lets the full-screen box escape the frame and sit over the rest of the screen.
  frameOpen: { overflow: "visible", zIndex: 100, borderRadius: 0 },
  backdrop: { position: "absolute", backgroundColor: "#000" },
  inline: { ...StyleSheet.absoluteFill, borderRadius: 26, overflow: "hidden" },
  controlsBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 48, paddingTop: 24, paddingBottom: 16, backgroundColor: "rgba(0,0,0,0.45)" },
  exit: { position: "absolute", top: 16, right: 48, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  frame: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", overflow: "hidden", borderRadius: 26 },
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
    backgroundColor: "rgba(245,234,216,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
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
